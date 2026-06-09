import axios from 'axios';
const BASE = process.env.CONTENTFUL_BASE_URL || 'https://d2ab400qlgxn2g.cloudfront.net/dev/spaces/xxg4p8gt3sg6/environments/master/entries';
const TOKEN = process.env.CONTENTFUL_TOKEN;
console.log('env token present:', !!TOKEN, '| token starts:', (TOKEN||'').slice(0,12));
try {
  const res = await axios.get(BASE, {
    params: { content_type: 'onePager', 'fields.name': 'aut > ind > en', include: '10' },
    headers: { Authorization: 'Bearer ' + TOKEN, Referer: 'https://visa.vfsglobal.com/', 'Accept-Language': 'en-US' },
    timeout: 30000,
  });
  const d = res.data;
  const e = (d.includes && d.includes.Entry) || [];
  const t = e.filter(x => x.fields && x.fields.table && /visa fee/i.test(x.fields.table));
  console.log('AXIOS+ENV-TOKEN: total=' + d.total + ' entries=' + e.length + ' feeTables=' + t.length);
} catch (err) {
  console.log('ERR:', err.response ? err.response.status : err.message);
}
