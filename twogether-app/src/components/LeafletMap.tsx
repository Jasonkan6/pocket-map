import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { Place } from '../types';

const BLOOM_EMOJI = ['🌱', '🌿', '🌳', '🌲', '🌸', '🌴'];

function buildHtml(places: Place[]): string {
  // Serialise places safely for injection into the HTML string
  const json = JSON.stringify(places).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%}
    .bp{
      width:38px;height:38px;
      background:rgba(92,122,95,0.18);
      border:2px solid #5C7A5F;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:20px;
      cursor:pointer;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var BLOOM=${JSON.stringify(BLOOM_EMOJI)};
var places=${json};
var valid=places.filter(function(p){return p.lat&&p.lng;});

var map=L.map('map',{zoomControl:true,attributionControl:true});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains:'abcd',maxZoom:20
}).addTo(map);

if(valid.length===0){
  map.setView([23.97,120.97],7);
}else if(valid.length===1){
  map.setView([valid[0].lat,valid[0].lng],14);
}else{
  map.fitBounds(valid.map(function(p){return[p.lat,p.lng];}),{padding:[44,44]});
}

valid.forEach(function(place){
  var level=Math.min(place.bloom_level||0,5);
  var icon=L.divIcon({
    className:'',
    html:'<div class="bp">'+BLOOM[level]+'</div>',
    iconSize:[38,38],
    iconAnchor:[19,19]
  });
  L.marker([place.lat,place.lng],{icon:icon})
    .addTo(map)
    .on('click',function(){
      window.ReactNativeWebView.postMessage(JSON.stringify(place));
    });
});
</script>
</body>
</html>`;
}

type Props = {
  places: Place[];
  onPlaceSelect: (place: Place) => void;
  style?: ViewStyle;
};

export default function LeafletMap({ places, onPlaceSelect, style }: Props) {
  function handleMessage(event: WebViewMessageEvent) {
    try {
      const place = JSON.parse(event.nativeEvent.data) as Place;
      onPlaceSelect(place);
    } catch {}
  }

  return (
    <WebView
      style={[styles.map, style]}
      source={{ html: buildHtml(places) }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={handleMessage}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
