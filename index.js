let puppeteer = require("puppeteer");
const fs = require('fs');



//let twitter_url = "https://platform.twitter.com/embed/Tweet.html?id=ddddddddddddddddddd";
let twitter_url = process.argv[2];
let user_id = twitter_url.match(/\d+$/);
console.log("User id is:"+user_id);
let embed_url = `https://platform.twitter.com/embed/Tweet.html?id=${user_id}`;
let output_file_name = "./superfile.mp4";
console.log(twitter_url);

console.log(twitter_url);
console.log(twitter_url);


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
        headless: false,
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
  
  let request_interception = true;
  let my_tweet_result = null;
  if(request_interception)
  {
      await page.setRequestInterception(true);
    page.on("request", (interceptedRequest) => {
        console.log(`Intercepted request: ${interceptedRequest.method()} ${interceptedRequest.url()}`);
        if(interceptedRequest.url().includes("https://cdn.syndication.twimg.com/tweet-result"))
        {
             my_tweet_result = fetch(interceptedRequest.url());
        }
        interceptedRequest.continue();
    });

    page.on("response", (response) => {
        let url = response.url();
        console.log(`Intercepted response: ${url}`);
        if(url.includes("https://cdn.syndication.twimg.com/tweet-result"))
        {
        }
    });
  }

    await page.goto(embed_url);
    while(my_tweet_result == null)
    {

    }
    let fetch_res = await my_tweet_result;

    let body = await fetch_res.json();

    console.log(body);
      let variant_array = body.video.variants;
      let my_mp4_url = variant_array[0].src;

      let mp4_data = new Buffer(await (await (await fetch(my_mp4_url)).blob()).arrayBuffer());

    let res = fs.writeFileSync(output_file_name,mp4_data, (err) => {console.error(err)});

      console.log("Downloaded!");

  })();