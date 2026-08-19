const fs = require('fs');

const files = [
  'CareerDNACursor/data/assessment-v4.json',
  'CareerDNACursor/data/assessment-v5.json'
];

files.forEach(filepath => {
  console.log('--- ' + filepath + ' ---');
  const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const questions = [];
  
  function findQuestions(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(item => findQuestions(item));
    } else {
      if (obj.questionType !== undefined || (obj.type !== undefined && (obj.text !== undefined || obj.question !== undefined))) {
        questions.push(obj);
      } else {
        for (const key in obj) {
          findQuestions(obj[key]);
        }
      }
    }
  }
  
  findQuestions(content);
  
  const grouped = {};
  questions.forEach(q => {
    const qType = q.questionType || q.type || 'unknown';
    if (!grouped[qType]) grouped[qType] = [];
    grouped[qType].push(q);
  });
  
  for (const qType in grouped) {
    const list = grouped[qType];
    const missing = list.filter(q => {
      const opts = q.options || q.choices;
      return !opts || (Array.isArray(opts) && opts.length === 0);
    });
    console.log(`Type: ${qType} | Count: ${list.length} | Missing Options: ${missing.length}`);
    const sample = list[0];
    const opts = sample.options || sample.choices;
    console.log(`  Sample: "${sample.text || sample.question || sample.title}"`);
    console.log(`  Options: ${opts ? JSON.stringify(opts).substring(0, 80) : 'none/empty'}`);
  }
});
