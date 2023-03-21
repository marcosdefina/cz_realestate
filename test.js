const fs = require('fs');
const readline = require('readline');

const filePath = 'links_to_process.txt';
const tmpFilePath = `${filePath}.tmp`;
const matchArray = ['https://www.sreality.cz/en/detail/sale/house/cottage/krizany-zibridice-/2659050572',
                    'https://www.sreality.cz/en/detail/sale/house/family/bily-potok-bily-potok-/1979569228']; // Array of lines to remove

const readStream = fs.createReadStream(filePath);
const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

const writeStream = fs.createWriteStream(filePath + '.tmp');

rl.on('line', (line) => {
  if (!matchArray.includes(line)) {
    writeStream.write(line + '\n');
  }
});

rl.on('close', async () => {
  writeStream.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  fs.unlinkSync(filePath); 
  fs.rename(tmpFilePath, filePath, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('File renamed successfully');
    }
  });
});