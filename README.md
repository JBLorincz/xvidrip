# XVIDRIP 
A command-line video downloader for X / Twitter

NOTE: xvidrip is a proof-of-concept tool made in a weekend.
xvidrip downloads the videos in tweets as MP4 files, no API required thanks to a headless browser.

## Installation
Clone the repository and install dependencies with `npm i`. Install xvidrip to your system with `npm i -g`. xvidrip should now be usable across your system.



## Usage 

`xvidrip <source_url> -flags [destination_path]`

Example: `xvidrip twitter.com/fakeusername/status/123456789 -v ~/Videos/output.mp4`

Or, just specify the post ID: `xvidrip 123456789 -v ~/Videos/output.mp4`