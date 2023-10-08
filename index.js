let puppeteer = require("puppeteer");
const fs = require('fs');
const { program } = require('commander');
const path = require('path');

//initialize CMD arg structure
program
  .argument("<source>", "the URL to the tweet or the ID of the tweet.")
  .option("-v --verbose", "output extra information",false)
  .option("-h --with-head", "run xvidrip not headlessly",false)
  .argument("[destination]", "the path and filename of the output file")
  .parse(process.argv);

let programArgs = program.args;
let programOptions = program.opts();

function verbose_print(strToPrint) {
  if (programOptions.verbose) {
    console.log(strToPrint);
  }
}

let sourceInput = programArgs[0];
let userDestination = programArgs[1];

let userId = sourceInput.match(/\d+$/);

verbose_print(`User id is: ${userId}`);

let embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${userId}`;
  

console.log(sourceInput);


(async () => {
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

  // attach cdp session to page
  const client = await page.target().createCDPSession();
  await client.send('Debugger.enable');
  await client.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });

  // enable network
  await client.send('Network.enable');

  // Enable request interception

  let myTweetResult = null;

  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    verbose_print(`Intercepted request: ${interceptedRequest.method()} ${interceptedRequest.url()}`);
    if (interceptedRequest.url().includes("https://cdn.syndication.twimg.com/tweet-result")) {
      myTweetResult = fetch(interceptedRequest.url());
    }
    interceptedRequest.continue();
  });

  page.on("response", (response) => {
    let url = response.url();
    verbose_print(`Intercepted response: ${url}`);
    if (url.includes("https://cdn.syndication.twimg.com/tweet-result")) {
    }
  });

  await page.goto(embedUrl);
  while (myTweetResult == null) {

  }
  let fetchResponse = await myTweetResult;

  let body = await fetchResponse.json();

  console.log(body);
  let variantArray = body.video.variants;
  

  let mp4Url = identifyBestVariant(variantArray);

  //todo: find right source to download in the variant_array

  let mp4AsBuffer = new Buffer(await (await (await fetch(mp4Url)).blob()).arrayBuffer());

  let fullPath = resolveDownloadPath(userDestination); 

  fs.writeFileSync(fullPath, mp4AsBuffer, (err) => { console.error(err) });

  console.log(`Downloaded to ${fullPath}`);
  browser.close();
  process.exit(0);
})();


function resolveDownloadPath(userDestination)
{
  let dirName = __dirname;
  let fileName = "video";
  let extName = ".mp4";
  if(userDestination)
  {
    dirName = path.dirname(userDestination);
    fileName = path.basename(userDestination);
    extName = path.extname(userDestination);

    if(extName != ".mp4")
    {
      console.warn("Warning: Specified an output file that's not an mp4. xvidrip can only download mp4 files. Please change the output file to an mp4 afterwards.");
    }
  }
  let baseFilename = fileName;
  //check if file exist, if it does add a number to end until one doesn't
  let int_modifier = 0;
  let break_loop = false;
do
{
  fullPath = path.join(dirName,fileName + extName);
  let doesFileExist = fs.existsSync(fullPath);
  if (!doesFileExist) {
    fullPath = path.join(dirName,fileName+extName);
    console.log(`Downloading video to: ${fullPath}`);
    break_loop = true;
  } else {
    int_modifier++;
    fileName = baseFilename+"_"+int_modifier;
    console.warn(`Checking if ${fileName} exists already...`);
  }
} while(!break_loop);

return fullPath;
}


function identifyBestVariant(variantArray)
{
  let filtered_variant_array = new Array();
  for(let x of variantArray)
  {
    if(x.src.includes("mp4") && x.type=="video/mp4")
    {
      filtered_variant_array.push(x);
    } 
  }
  let mp4Url = filtered_variant_array[0].src;
  return mp4Url;
}