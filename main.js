const { links, wait, deleteProcessedLines,
   get_house_details, fetchLinksToProcess,
    scrapeHouseLinks, storeProcessedLinks, storeCsv, 
    createFileName, getGlobalSettings, updateGlobalSettings, storeJson, filterProcessedLinks, filterProcessedLinks2 } = require('./utils')

TOTAL_ADVERTS= 17108,
TOTAL_BATCHES= 861,
BATCHES_SIZE= 20,
STARTING_BATCH=0,
TOTAL_PROCESSED_ADVERTS= 0,
BATCHES_PER_FULL_RUN= 5,
FEW_ADVERTS_CUTOFF = 1,
BATCH_FIRST_DAY = 1


const inputPath = process.argv[2] //nothing returns undefined
let csvPath = inputPath || createFileName()
let jsonPath = inputPath || createFileName('json', 'json')
let filePath = jsonPath



async function main(starting_batch=null, total_processed=null){
  processedBatchesCounter = starting_batch
  adverts_processed_total = total_processed
  final_batch = TOTAL_BATCHES

  curr_batch = BATCH_FIRST_DAY

  await filterProcessedLinks2()//eliminate already processed links
  //filterProcessedLinks2('./links_to_process.txt','./links_to_process.txt')//eliminate duplicates

  if (inputPath === 'last' && !starting_batch) {
    await getGlobalSettings('last_filename')
    .then((value) => {
      filePath = value
      console.log(`The value of last_filename is: ${value}`);
    })
    .catch((err) => {
      console.error(`Error retrieving global setting: ${err}`);
    });

  } else if (inputPath !== 'last' && !starting_batch) {
    await updateGlobalSettings(setting='last_filename', value=createFileName('json', 'json'))
  }

  if(!processedBatchesCounter && inputPath !== 'new'){
  
    await getGlobalSettings('processedBatchesCounter')
    .then((value) => {
      processedBatchesCounter = value
      console.log(`The value of processedBatchesCounter is: ${value}`);
    })
    .catch((err) => {
      console.error(`Error retrieving global setting: ${err}`);
    });
  } else if (inputPath === 'new'){
    processedBatchesCounter = 0
  }

  if(!adverts_processed_total && inputPath !== 'new'){
    await getGlobalSettings('adverts_processed_total')
    .then((value) => {
      adverts_processed_total = value
      console.log(`The value of adverts_processed_total is: ${value}`);
    })
    .catch((err) => {
      console.error(`Error retrieving global setting: ${err}`);
    });
  } else if (inputPath === 'new'){
    adverts_processed_total = 0
  }

  await getGlobalSettings('curr_batch')
    .then((value) => {
      curr_batch = value
      console.log(`The value of curr_batch is: ${value}`);
    })
    .catch((err) => {
      console.error(`Error retrieving global setting: ${err}`);
    });

  processedBatches = []
  
  batches = curr_batch + BATCHES_PER_FULL_RUN > final_batch ? 
              final_batch : BATCHES_PER_FULL_RUN //810//

  const links = await fetchLinksToProcess()
  
  if(links.length < FEW_ADVERTS_CUTOFF + 1 || links === [ '' ] ) {
    console.log('Not Enough links to process: fetching more {} links'.replace('{}', batches*20))
    try{
      await scrapeHouseLinks(batches, curr_batch)
    } catch(err) {
      console.log(`Error scraping links: ${err}`)
    }
    await wait(10000)
    console.log('starting main again')
    await main(processedBatchesCounter, adverts_processed_total)
  }

  house_details_list = []
  links_len =  links.length //892

  if (links_len > 50) {
    links_len = 50
  }

  this_batch_counter = 0
  console.log('links_len: ', links_len)
  for(let i = 0; i < links_len; i++) {
    if (links[i]){
      if(typeof links === 'string'){
        if (!links[i].includes('https://www.sreality.cz')) {
          console.log('bad link: '+links[i]+', skipping')
          continue
      }
      else { 
      continue
      }
    }
  }
    try {
      await get_house_details(links[i]).then(async (details) => {
        if(details){
          adverts_processed_total += 1
          this_batch_counter += 1
          house_details_list.push(details)
      }
      })}
    catch(err) {
      console.log("Error on Main Loop")
      //await storeCsv(house_details_list)
      await storeJson(house_details_list, filePath) //implement properly later, it's costing too much space
      await storeProcessedLinks(links.slice(0, this_batch_counter))
      await deleteProcessedLines(links.slice(0, this_batch_counter))
      console.log(err)
    }
    console.log("Progress( " + (i+1) + " out of " + links_len + " ads ): ", (1+i)*1.0000/links_len * 100.0000 + "%")
    let waiting = Math.random() * 3000 + 2000
    console.log("Waiting: ", waiting/1000 + " seconds")
    
    if( i%5 == 0 ){//fire 10 events simultaneously wait a random amount of time between 2 and 5 seconds
      await wait(waiting)
    }
    //for speeding up the debugging, REMOVE THIS LINE LATTER
    console.log("Processed: ", adverts_processed_total)
  }

  //await storeCsv(house_details_list, csvPath)
  await storeJson(house_details_list, filePath) //implement properly later, it's costing too much space

    await storeProcessedLinks(links.slice(0, this_batch_counter))
    await deleteProcessedLines(links.slice(0, this_batch_counter))

    processedBatchesCounter += BATCHES_PER_FULL_RUN

    await updateGlobalSettings(setting='processedBatchesCounter', value=processedBatchesCounter)
    await updateGlobalSettings(setting='adverts_processed_total', value=adverts_processed_total)
    await updateGlobalSettings(setting='curr_batch', value=curr_batch+batches)

    await wait(10000)
    
    if(adverts_processed_total < 17000) {
      console.log('{} adverts processed. Starting new Batch'.replace('{}', adverts_processed_total))
      main(processedBatchesCounter, adverts_processed_total)
    } else {
      console.log('{} adverts processed. Ending Process'.replace('{}', adverts_processed_total))
      return
    }

}


main()