const axios = require('axios');
const cheerio = require("cheerio");
const unirest = require("unirest");
const AWS = require('aws-sdk');

// Mcwf9Ia47w57 EDy6DmqZGJEUfjdNl92 Lu0ly ghp

const selectRandomUserAgent = () => {
    const userAgents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"]
    var randomNumber = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomNumber];
}

const scraper = async(keyword, page) => {
	let p = 10*(page-1);
	let url = 'https://www.google.com/search?hl=fr&as_epq=&as_oq=&as_eq=&as_nlo=&as_nhi=&lr=lang_fr&cr=countryFR&as_qdr=all&as_sitesearch=&as_occt=any&as_filetype=&tbs=&start='+p+'&as_q='+keyword;
	return unirest
	.get(url)
	.headers({
		"User-Agent": selectRandomUserAgent()
	})
	.then((response) => {
		let $ = cheerio.load(response.body);

		let results = [];
		
		if($(".g-recaptcha").length) {
			throw new Error('Recaptcha');
		}
		
		$(".g:has(a:has(h3))").each((i,el) => {
			results.push({
				url: $(el).find('a').first().attr('href'),
				title: $(el).find('h3').first().text()
			})
		})
		
		return {results: results, debug: response.body};
	})
	.catch((error) => {
		throw new Error('Recaptcha');
	});
}

exports.handler = async (event) => {
	const { keyword, page } = event.pathParameters;
	try {
		const scraper_data = await scraper(keyword, page);
		const response = {
			statusCode: 200,
			body: JSON.stringify({results: scraper_data.results, _debug: scraper_data.debug, _rt: process.env.RESTART_TIME})
		}
		return response;
	} catch(error) {
		AWS.config.update({region:'eu-west-3'});
		AWS.config.credentials = { 
			"accessKeyId": process.env.USER_AWS_ACCESS_KEY_ID,
			"secretAccessKey": process.env.USER_AWS_SECRET_ACCESS_KEY
		};
		const lambda = new AWS.Lambda();
		const params = {
		  FunctionName: 'scrapr',
		  Environment: {
			Variables: {
			  'USER_AWS_ACCESS_KEY_ID': process.env.USER_AWS_ACCESS_KEY_ID,
			  'USER_AWS_SECRET_ACCESS_KEY': process.env.USER_AWS_SECRET_ACCESS_KEY,
			  'RESTART_TIME': Date.now().toString()
			}
		  }
		};
		lambda.updateFunctionConfiguration(params, function(err, data) {
		  if (err) console.log(err, err.stack);
		});
		return {
			statusCode: 429
		};
	}
}