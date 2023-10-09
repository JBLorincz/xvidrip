#!/usr/bin/env node

let puppeteer = require("puppeteer");
const fs = require('fs');
const { program } = require('commander');
const path = require('path');
const os = require('os');
const axios = require('axios');
const AsyncRetry = require("async-retry");
const { setTimeout } = require("timers/promises");
//initialize CMD arg structure
program
  .argument("<source>", "the URL to the tweet or the ID of the tweet.")
  .option("-v --verbose", "output extra information", false)
  .option("-s --silent", "removes all stdout output, overriding other flags", false)
  .option("-h --with-head", "run xvidrip with a head", false)
  .argument("[destination]", "the path and filename of the output file")
  .parse(process.argv);

let programArgs = program.args;
let programOptions = program.opts();

function verbose_print(strToPrint) {
  if(programOptions.silent) return;
  if (programOptions.verbose) {
    console.log(strToPrint);
  }
}
function print(strToPrint)
{
 if(programOptions.silent) return;
    console.log(strToPrint);
}

let sourceInput = programArgs[0];
let userDestination = programArgs[1];

let userId = sourceInput.match(/\d+$/);

verbose_print(`User id is: ${userId}`);

let embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${userId}`;


verbose_print(sourceInput);


(async () => {
  
  let fetchResponse;
  await AsyncRetry(async(bail) => {

    fetchResponse = await getTweetResult();
  },
  {retries: 5, onRetry: () => {print("Retrying...")}}
  );

  print("Converting tweet result to JSON...");
  let body = await fetchResponse;


  verbose_print(body);
  let variantArray = body.data.video.variants;


  let mp4Url = identifyBestVariant(variantArray);

  //todo: find right source to download in the variant_array

  let mp4AsBuffer = await downloadMp4(mp4Url);

  let fullPath = resolveDownloadPath(userDestination);

  if (!fs.existsSync(path.dirname(fullPath))) {
    {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
  }
  fs.writeFileSync(fullPath, mp4AsBuffer, (err) => { console.error(err) });

  print(`Downloaded to ${fullPath}`);
  process.exit(0);
})();

//We only need puppeteer for this part.
async function getTweetResult()
{
  print("Opening puppeteer...");
// Launch the browser and open a new blank page
  let config = {
    // Whether chrome should simulate
    // the absence of connectivity
    'offline': false,
    // Simulated download speed (bytes/s)
    'downloadThroughput': 0,
    // Simulated upload speed (bytes/s)
    'uploadThroughput': 0,
    // Simulated latency (ms)
    'latency': 22,
    args: ['--disable-cache'],
    headless: !programOptions.withHead,
  }
  const browser = await puppeteer.launch(config);
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36');

  let myTweetResult = null;

  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    verbose_print(`Intercepted request: ${interceptedRequest.method()} ${interceptedRequest.url()}`);
    if (interceptedRequest.url().includes("https://cdn.syndication.twimg.com/tweet-result")) {
      myTweetResult = axios.get(interceptedRequest.url());
    }
    interceptedRequest.continue();
  });

  page.on("response", (response) => {
    let url = response.url();
    verbose_print(`Intercepted response: ${url}`);
  });
   

  let error_object = null;

   const timer = setTimeout(() => {
  }, 3000);
  timer.then(() => {error_object = new Error("Timed out!");})
  //start the process by going to the embed page.
  await page.goto(embedUrl);

  while (myTweetResult == null) {
    if(error_object)
    {

      browser.close();
      throw error_object;
    }
  }
  clearTimeout(timer);
  browser.close();
  return myTweetResult;
}

function resolveDownloadPath(userDestination) {
  print("Resolving download path...");
  let dirName = __dirname;
  let fileName = "video";
  let extName = ".mp4";
  if (userDestination) {
    dirName = path.dirname(userDestination);
    extName = path.extname(userDestination);
    fileName = path.basename(userDestination, extName);

    if (extName != ".mp4") {
      console.warn("Warning: Specified an output file that's not an mp4. xvidrip can only download mp4 files. Please change the output file to an mp4 afterwards.");
    }
  }
  dirName = untildify(dirName);
  let baseFilename = fileName;
  //check if file exist, if it does add a number to end until one doesn't
  let int_modifier = 0;
  let break_loop = false;
  do {
    fullPath = path.join(dirName, fileName + extName);
    let doesFileExist = fs.existsSync(fullPath);
    if (!doesFileExist) {
      fullPath = path.join(dirName, fileName + extName);
      break_loop = true;
    } else {
      int_modifier++;
      fileName = baseFilename + "_" + int_modifier;
      if (programOptions.verbose) {
        console.warn(`Checking if ${fileName} exists already...`);
      }
    }
  } while (!break_loop);

  return fullPath;
}


function identifyBestVariant(variantArray) {
  verbose_print("Identifying best variant...");
  let filtered_variant_array = new Array();
  for (let x of variantArray) {
    if (x.src.includes("mp4") && x.type == "video/mp4") {
      filtered_variant_array.push(x);
    }
  }
  let mp4Url = filtered_variant_array[0].src;
  verbose_print(`Best variant identified: ${mp4Url}`);
  return mp4Url;
}

async function downloadMp4(mp4Url)
{
  print(`Downloading mp4 from '${mp4Url}'...`);
  let arrayBuffer =  await axios(mp4Url, {
    responseType: 'arraybuffer'
  }); 
  return Buffer.from(arrayBuffer.data);
}

const homeDirectory = os.homedir();

function untildify(pathWithTilde) {
  if (typeof pathWithTilde !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof pathWithTilde}`);
  }

  return homeDirectory ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory) : pathWithTilde;
}