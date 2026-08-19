const fs = require('fs');

const files = [
  'CareerDNACursor/data/assessment-v4.json',
  'CareerDNACursor/data/assessment-v5.json'
];

files.forEach(filepath => {
  console.log('====================================');
  console.log('Analyzing file: ' + filepath);
  console.log('====================================');
  
  if (!fs.existsSync(filepath)) {
    console.log('File ' + filepath + ' does not exist.');
    return;
  }
  
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
  console.log('Found ' + questions.length + ' total questions.');
  
  if (questions.length === 0) {
    console.log('Root keys:', Object.keys(content));
    return;
  }
  
  const grouped = {};
  questions.forEach(q => {
    const qType = q.questionType || q.type || 'unknown';
    if (!grouped[qType]) {
      grouped[qType] = [];
    }
    grouped[qType].push(q);
  });
  
  for (const qType in grouped) {
    const list = grouped[qType];
    console.log('\nQuestion Type: ' + qType + ' (Count: ' + list.length + ')');
    
    const missingOrEmptyOptions = list.filter(q => {
      const opts = q.options || q.choices;
      return !opts || (Array.isArray(opts) && opts.length === 0);
    });
    
    console.log('  Questions with missing/empty options: ' + missingOrEmptyOptions.length + ' out of ' + list.length);
    console.log('  Sample Questions:');
    const samples = list.slice(0, 2);
    samples.forEach((q, idx) => {
      const opts = q.options || q.choices;
      const optsInfo = opts ? 'options present (' + JSON.stringify(opts).substring(0, 150) + ')' : 'options completely missing/null/undefined';
      
      console.log('    Sample ' + (idx + 1) + ':');
      console.log('      Id/Text: ' + (q.id || q.key || 'N/A') + ' - "' + (q.text || q.question || q.title || 'N/A') + '"');
      console.log('      Options: ' + optsInfo);
    });
  }
});
