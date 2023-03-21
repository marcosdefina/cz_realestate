const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const { openSync } = require('fs');
const readline = require('readline');
const json2csv = require('json2csv').parse;
const util = require('util');
const { promises: fsPromises } = require('fs');

  
const { pipeline } = require('stream');
const { createReadStream, createWriteStream } = require('fs');
const { promisify } = require('util');




example_link = 'https://www.sreality.cz/en/detail/sale/house/family/kraluv-dvur-zahorany-/2642626380'

//get_house_details(example_link)

module.exports = {
    links : {
        base_link: 'https://www.sreality.cz',
        home_page: 'https://www.sreality.cz/en',
        houses_page: 'https://www.sreality.cz/en/search/for-sale/houses',
        page_2: 'https://www.sreality.cz/en/search/for-sale/houses?page=2',
        page_3: 'https://www.sreality.cz/en/search/for-sale/houses?page=2',
        page_number_template: 'https://www.sreality.cz/en/search/for-sale/houses?page='
      },
      
      get_house_details: async function (url) {
        return new Promise(async (resolve, reject) => {
            try {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.goto(url);
                const content = await page.content();
    
    
                const $ = cheerio.load(content);
    
                const house_details = $('.params.clear');
    
                let house_detals = []
                const ul_det = house_details.find('ul');
    
                ul_det.find('li').each(function (i, li) {
                    let $li = $(li);
                    let label = $li.find('label').text().replace(':', '');
                    let value = $li.find('strong').find('span').text();
                    let object = { label, value }
                    house_detals.push(object)
                })
    
                let transposeDetails = house_detals.reduce((acc, cur) => {
                    acc[cur.label] = cur.value;
                    return acc;
                }, {});

                // PARSE LOCATION
                //<span class="location-text ng-binding">Králův Dvůr - Zahořany, district Beroun</span>
                const location_on_title = $('.location-text.ng-binding').text();
                const location = $('.span.location').text();
                // const spans = $('span')
                // const locality = spans.find('class="locality ng-binding"')
                const locality = $('.locality.ng-binding').text();
    
    
                // PARSE PUBLIC SERVICES NEARBY
                const preact = $('[data="publicEquipment"]');
                const navigate_preact_div = preact.find('div')
                const ul = navigate_preact_div.find('ul')
    
                let ul_items = []
                ul.find('li').each((i, elem) => {
                    const label = $(elem).find('label').text().replace(":", "");
                    const service_name = $(elem).find('span').find('a').find('span').text()
                    const distance = $(elem).find('span').find('span').text().replace('(', '').replace(')', '').replace(service_name, '');
    
                    object = { label, service_name, distance }
                    ul_items.push(object)
                });
    
                let transposeServices = ul_items.reduce((acc, cur) => {
                    acc[cur.label] = cur.service_name + ' - dist: ' + cur.distance;
                    return acc;
                }, {});
    
                let house_category = example_link.split('/')[7];
    
                let extendedObj = Object.assign({ id: url.split('\n')[0], link: url.split('\n')[0], category: house_category.split('\n')[0], title_location:location_on_title.split('\n')[0], location: location.split('\n')[0], locality: locality.split('\n')[0] }, transposeDetails, transposeServices);
    
                await browser.close();
    
                resolve(extendedObj);
            } catch (error) {
                console.log('Error on get_house_details', error);
                resolve();
            }
        });
    },
    

    get_advert_url_list: async function (url) {
        return new Promise((resolve, reject) => {
            const {match_section, storeLinksToProcess, wait} = module.exports;

            (async () => {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.goto(url);
                await wait(10000)
                const content = await page.content();

                console.log('url: ', url); // ok


                const $ = cheerio.load(content);

                const desiredHrefs = [];

                match_section($, tag = 'a', attr = 'ng-href', starts_with = '/en/detail/sale/house/', link_template = 'https://www.sreality.cz', desiredHrefs)

                resolve(desiredHrefs);
                try {
                  await storeLinksToProcess(desiredHrefs)
                }catch(error){
                  console.log('Error storing links to process', error)
                }

                await browser.close();
                return desiredHrefs
            })();
        });
    },

    // get_advert_url_list: async function (url) {
    //   return new Promise((resolve, reject) => {
    //     const { match_section, storeLinksToProcess } = module.exports;
    //     const desiredHrefs = [];
    //     (async () => {
    //       const browser = await puppeteer.launch();
    //       const page = await browser.newPage();
    //       await page.goto(url);
    //       console.log('url: ', url); // ok
    
    //       const getContent = async () => {
    //         await page.reload();
    //         const content = await page.content();
    //         const $ = cheerio.load(content);
            
    //         match_section($, tag = 'a', attr = 'ng-href', starts_with = '/en/detail/sale/house/', link_template = 'https://www.sreality.cz', desiredHrefs);
    
    //         resolve(desiredHrefs);
    //         try {
    //           await storeLinksToProcess(desiredHrefs);
    //         } catch (error) {
    //           console.log('Error storing links to process', error);
    //         }
    //       };
    
    //       await getContent();
    //       await browser.close();
    //       return desiredHrefs;
    //     })();
    //   });
    // },
    

    match_section: function ($, tag = 'a', attr = 'ng-href', starts_with = '/en/detail/sale/house/', link_template = 'https://www.sreality.cz', desiredHrefs) {
        $(tag).each(function () {
            const href = $(this).attr(attr);
            console.log('href: ', href);
            if (href && href.startsWith(starts_with)) {
                desiredHrefs.push(link_template + href);
            }
        })
        return desiredHrefs;
    },

    scrapeHouseLinks: function(batches, curr_batch) {
        return new Promise(async (resolve, reject) => {
          const { links, get_advert_url_list, wait } = module.exports;
      
          //batch_first_day = 60
          batch_first_day = 0
          number_of_pages = 861
      
          stop_at = curr_batch + batches > number_of_pages ? number_of_pages : curr_batch + batches
      
          list_of_urls = []
      
          for (let i = curr_batch; i < stop_at; i++) {
            console.log('link_gatering ( '+i+' out of 855: ' +i/8.55000+'% )' )
            const url = i == 1 ? links.houses_page : links.page_number_template + i;
            try{
              const curent_url_list = await get_advert_url_list(url, i)
              list_of_urls = list_of_urls.concat(curent_url_list)
            }
            catch(error){
              console.log('Error on get_advert_url_list', error);
            }
              let waiting = Math.random() * 7000 + 3000
              console.log('waiting for '+ waiting +'ms')
              wait(waiting)
            }
      
          resolve(list_of_urls);
        });
      },
      
    wait: async function (ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

    fetchLinksToProcess: async function () {
        return new Promise((resolve, reject) => {
          const filePath = "./links_to_process.txt";
          let lines = []
      
          fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
              // file does not exist, create it and return empty array
              fs.writeFile(filePath, '', "utf-8", (err) => {
                if (err) {
                  console.error(err);
                  reject(err);
                } else {
                  resolve(lines);
                }
              });
            } else {
              // file exists, read its contents and split into lines
              fs.readFile(filePath, (err, data) => {
                if (err) {
                  console.error(err);
                  reject(err);
                } else {
                  lines = data.toString().split("\n")
                  resolve(lines);
                }
              });
            }
          });
        });
      },      

      storeProcessedLinks: function (processed_links) {
        return new Promise((resolve, reject) => {
          processed_links.push('')
          const filePath = "./processed_links.txt";
          const batch = processed_links.join("\n");

      
          fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
              // file does not exist, create it
              fs.writeFile(filePath, batch, "utf-8", (err) => {
                if (err) {
                  console.error(err);
                  reject(err);
                }
                resolve();
              });
            } else {
              // file exists, append to it
              fs.appendFile(filePath, batch, "utf-8", (err) => {
                if (err) {
                  console.error(err);
                  reject(err);
                }
                resolve();
              });
            }
          });
        });
      },      

      // storeLinksToProcess: async function (links_to_process) {
      //   const filePath = "./links_to_process.txt";
      //   const batch = links_to_process.join("\n");
      
      //   try {
      //     await fsPromises.access(filePath, fs.constants.F_OK);
      //     // file exists, append links to it
      //     await fsPromises.appendFile(filePath, batch, "utf-8");
      //   } catch (err) {
      //     if (err.code === 'ENOENT') {
      //       // file does not exist, create it and write links to it
      //       await fsPromises.writeFile(filePath, batch, "utf-8");
      //     } else {
      //       console.error(`Failed to add lines to be processed on ${filePath}`);
      //       console.error(err);
      //       throw err;
      //     }
      //   }
      // },
    
      storeLinksToProcess: async function (links_to_process) {
        const filePath = "./links_to_process.txt";
        const batch = links_to_process.join("\n");
      
        return new Promise(async (resolve, reject) => {
          try {
            await fsPromises.access(filePath, fs.constants.F_OK);
            // file exists, append links to it
            await fsPromises.appendFile(filePath, batch, "utf-8");
          } catch (err) {
            if (err.code === 'ENOENT') {
              // file does not exist, create it and write links to it
              await fsPromises.writeFile(filePath, batch, "utf-8");
            } else {
              console.error(`Failed to add lines to be processed on ${filePath}`);
              console.error(err);
              reject(err);
            }
          }
          resolve();
        });
      },
      

      deleteProcessedLines: function (processedLines) {
          return new Promise((resolve, reject) => {
            const filePath = 'links_to_process.txt';
            const tmpFilePath = `${filePath}.tmp`;
            const matchArray = processedLines
        
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
        
            rl.on('close', () => {
              writeStream.end();
        
              writeStream.on('finish', async () => {
                  try {
                    await fsPromises.unlink(filePath);
                    await fsPromises.rename(tmpFilePath, filePath);
                    console.log('{} renamed successfully'.replace('{}', filePath));
                    resolve();
                  } catch (err) {
                    console.error('Failed to unlink or rename tmp file to file');
                    console.error(err);
                    reject(err);
                  }
                });
        
              writeStream.on('error', (err) => {
                  console.error('Failed to delete processed lines from {}'.replace('{}', filePath));
                  console.error(err);
                  reject(err);
              });
            });
          });
        },
      
  

  convert_to_csv: function (json) {
    if (json.length === 0) {
        return 0
    }
    const csv = json2csv(json);
    return csv;
  },

  storeCsv: async function(data, filePath) {
    const appendFile = util.promisify(fs.appendFile);
    const writeFile = util.promisify(fs.writeFile);
    const {convert_to_csv} = module.exports;
    const csv = convert_to_csv(data);
    if (csv === 0) {
      console.log('No data to store');
      return Promise.resolve(0);
    }
    try {
      if (fs.existsSync(filePath)) {
        await appendFile(filePath, csv, "utf-8");
        console.log(`Successfully appended CSV data to ${filePath}`);
      } else {
        await writeFile(filePath, csv, "utf-8");
        console.log(`Successfully wrote CSV data to ${filePath}`);
      }
      return Promise.resolve();
    } catch (error) {
      console.error(`Error writing CSV data to ${filePath}: ${error}`);
      return Promise.reject(error);
    }
  },

storeJson: async function (data, filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, fileData) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        let jsonArray = [];
        if (!err) {
          try {
            jsonArray = JSON.parse(fileData);
            if (!Array.isArray(jsonArray)) {
              reject(new Error(`${filePath} does not contain a JSON array`));
            }
          } catch (parseError) {
            reject(parseError);
          }
        }
        jsonArray = jsonArray.concat(data);
        const jsonString = JSON.stringify(jsonArray, null, 2);
        fs.writeFile(filePath, jsonString, (writeError) => {
          if (writeError) {
            reject(writeError);
          } else {
            console.log(`Successfully wrote JSON data to ${filePath}`);
            resolve();
          }
        });
      }
    });
  });
},


//   storeJson: async function (data, filePath) {
//     const { existsSync, writeFileSync } = require('fs');
  
//     let jsonArray = [];
  
//     // Check if the file exists
//     if (existsSync(filePath)) {
//       // Read existing JSON array from file
//       const existingJson = require(filePath);
//       if (Array.isArray(existingJson)) {
//         jsonArray = existingJson;
//       } else {
//         throw new Error('Invalid JSON data: Expected array');
//       }
//     }
  
//     // Add new object to JSON array
//     jsonArray.push(data);
  
//     // Write JSON array to file
//     writeFileSync(filePath, JSON.stringify(jsonArray, null, 2));
  
//     console.log(`Successfully wrote JSON data to ${filePath}`);
//   },  
  
  getGlobalSettings: async function (setting) {
    const filePath = './global_settings.json';
  
    return fsPromises.readFile(filePath, 'utf8')
      .then((data) => {
        const settings = JSON.parse(data);
        return settings[setting];
      })
      .catch((err) => {
        console.error(`Failed to read global settings from ${filePath}: ${err}`);
        throw err;
      });
  },

  createFileName: (fileName='csv', fileExtention='csv') => {
    const temp = new Date();
    const pad = (i) => (i < 10) ? "0" + i : "" + i;

    time =  temp.getFullYear() +
        pad(1 + temp.getMonth()) +
        pad(temp.getDate()) +
        pad(temp.getHours()) +
        pad(temp.getMinutes()) +
        pad(temp.getSeconds());
    
    result = './'+fileName+'_'+time+'.'+fileExtention

    return result
  },

  updateGlobalSettings: async function (setting, value) {
  const filePath = './global_settings.json';
  try {
    const data = await fsPromises.readFile(filePath, 'utf-8');
    const settings = JSON.parse(data);
    settings[setting] = value;
    await fsPromises.writeFile(filePath, JSON.stringify(settings, null, 2));
    console.log(`Setting "${setting}" updated to "${value}" in global_settings.json`);
  } catch (err) {
    console.error(`Failed to update setting "${setting}" to "${value}" in global_settings.json`);
    console.error(err);
    throw err;
  }
},


filterProcessedLinks2: async function (linksToProcessPath = './links_to_process.txt', processedFilePath='./processed_links.txt') {
  return new Promise((resolve, reject) => {
    fs.readFile(linksToProcessPath, 'utf8', (err, fileData) => {
      if (err) {
        reject(err);
      } else {
        fs.readFile(processedFilePath, 'utf8', (err, processedFileData) => {
          if (err && err.code !== 'ENOENT') {
            reject(err);
          } else {
            let linksToProcess = fileData.trim().split('\n');
            let processedLinks = [];
            if (!err) {
              processedLinks = processedFileData.trim().split('\n');
            }
            let filteredLinks = linksToProcess.filter(link => !processedLinks.includes(link));
            const filteredLinksString = filteredLinks.join('\n');

            if(filteredLinks != linksToProcess)
            { console.log(`Repeated links detected on batch. ${linksToProcess.length - filteredLinks.length} links filtered out`);}          

            fs.writeFile(linksToProcessPath, filteredLinksString, { encoding: 'utf8' }, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(filteredLinks);
              }
            });
          }
        });
      }
    });
  });
},

filterProcessedLinks: async function (linksToProcessPath = './links_to_process.txt', processedFilePath='./processed_links.txt') {
  return new Promise((resolve, reject) => {
    fs.readFile(linksToProcessPath, 'utf8', (err, fileData) => {
      if (err) {
        reject(err);
      } else {
        fs.readFile(processedFilePath, 'utf8', (err, processedFileData) => {
          if (err && err.code !== 'ENOENT') {
            reject(err);
          } else {
            let linksToProcess = fileData.trim().split('\n');
            
            const splitLinks = [];
            const pattern = /https:\/\//; // pattern to match the start of a new link
            
            for (const link of linksToProcess) {
              const split = link.split(pattern); // split the link at the pattern match
              splitLinks.push(...split); // add the split links to the new list
            } 

            linksToProcess = splitLinks;

            let processedLinks = [];
            if (!err) {
              processedLinks = processedFileData.trim().split('\n');
            }
            let filteredLinks = linksToProcess.filter(link => !processedLinks.includes(link));
            const filteredLinksString = filteredLinks.join('\n');

            if(filteredLinks != linksToProcess)
            { console.log(`Repeated links detected on batch. ${linksToProcess.length - filteredLinks.length} links filtered out`);}          

            fs.writeFile(linksToProcessPath, filteredLinksString, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(filteredLinks);
              }
            });
          }
        });
      }
    });
  });
}



// filterProcessedLinks: async function (linksToProcessPath = './links_to_process.txt', processedFilePath='./processed_links.txt') {
//   return new Promise((resolve, reject) => {
//     fs.readFile(linksToProcessPath, 'utf8', (err, fileData) => {
//       if (err) {
//         reject(err);
//       } else {
//         fs.readFile(processedFilePath, 'utf8', (err, processedFileData) => {
//           if (err && err.code !== 'ENOENT') {
//             reject(err);
//           } else {
//             let linksToProcess = fileData.trim().split('\n');
//             let processedLinks = [];
//             if (!err) {
//               processedLinks = processedFileData.trim().split('\n');
//             }
//             let filteredLinks = linksToProcess.filter(link => !processedLinks.includes(link));
//             const filteredLinksString = filteredLinks.join('\n');

//             console.log(processedLinks)
//             if(filteredLinks != linksToProcess)
//             { console.log(`Repeated links detected on batch. ${linksToProcess.length - linksToProcess.length} links filtered out`);}          

//             fs.writeFile(linksToProcessPath, filteredLinksString, (err) => {
//               if (err) {
//                 reject(err);
//               } else {
//                 resolve(filteredLinks);
//               }
//             });
//           }
//         });
//       }
//     });
//   });
// }


  
  
}