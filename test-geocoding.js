require('dotenv').config();

// 測試案例：模擬 Gemini 回傳的結果
const testCases = [
  { name: '鼎泰豐信義店', address: '台北市信義區市府路45號' },
  { name: '興波咖啡 Simple Kaffa', address: '' },           // 只有店名
  { name: '阿宗麵線', address: '台北市萬華區峨眉街8-1號' },
  { name: '不存在的假店名xyz123', address: '' },             // 應該找不到
];

async function geocode(name, address) {
  const query = address || name;
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json?address=' +
    encodeURIComponent(query + ' 台灣') +
    '&key=' + process.env.GOOGLE_MAPS_KEY;

  console.log('\n🔍 Query:', query);
  console.log('URL:', url.replace(process.env.GOOGLE_MAPS_KEY, '***'));

  try {
    const res = await fetch(url);
    const data = await res.json();

    console.log('Status:', data.status);

    if (data.error_message) {
      console.log('❌ Error message:', data.error_message);
      return;
    }

    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      console.log('✅ Found:', r.formatted_address);
      console.log('   lat/lng:', r.geometry.location.lat, r.geometry.location.lng);
    } else {
      console.log('⚠️ No results');
    }
  } catch (e) {
    console.log('❌ Fetch error:', e.message);
  }
}

(async () => {
  if (!process.env.GOOGLE_MAPS_KEY) {
    console.log('❌ GOOGLE_MAPS_KEY 沒有設定');
    return;
  }
  console.log('✅ API Key 長度:', process.env.GOOGLE_MAPS_KEY.length);

  for (const tc of testCases) {
    await geocode(tc.name, tc.address);
  }
})();
