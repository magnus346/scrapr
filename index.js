const axios = require('axios');
const cheerio = require("cheerio");
const unirest = require("unirest");
const AWS = require('aws-sdk');

const selectRandomUserAgent = () => {
    const userAgents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"]
    var randomNumber = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomNumber];
}

const scrapers = {
	discogsPrices: async(release_id) => {
		let url = 'https://www.discogs.com/fr/sell/release/'+release_id+'?sort=price%2Casc&limit=250&currency=EUR';
		return unirest
		.get(url)
		.headers({
			"User-Agent":
			selectRandomUserAgent()
		})
		.then((response) => {
			let $ = cheerio.load(response.body);

			let results = [];
			
			if($(".g-recaptcha").length)
				throw new Error('Recaptcha');
			$("tr[data-release-id]").each((i,el) => {
				results.push({
					price: $(el).find('.item_price').find(".price").first().attr("data-pricevalue"),
					currency: $(el).find('.item_price').find(".price").first().attr("data-currency"),
					shipping: $(el).find('.item_price').find(".item_shipping").first().text().replace(/,/g,'.').replace(/[^\d\.]/g,''),
					condition: $(el).find(".item_sleeve_condition").first().text()
				})
			})
			return results;
		})
		.catch((error) => {
			throw new Error('Recaptcha');
		});
	}
}

exports.handler = async (event) => {
	/*
	const ip = await axios.get('https://api.ipify.org/?format=json').catch(err => console.error(err))
	return {
		statusCode: 200,
		body: JSON.stringify({ip: ip.data})
	}
	*/
	const { id } = event.pathParameters;
	let results = null;
	try {
		if(id=='__restart__')
			throw new Error('Restart');
		results = await scrapers.discogsPrices(id)
	} catch(error) {
		AWS.config.update({region:'eu-west-3'});
		AWS.config.credentials = { 
			"accessKeyId": process.env.USER_AWS_ACCESS_KEY_ID,
			"secretAccessKey": process.env.USER_AWS_SECRET_ACCESS_KEY
		};
		const lambda = ;
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
		new AWS.Lambda().updateFunctionConfiguration(params, function(err, data) {
		  if (err) console.log(err, err.stack);
		  return {
				statusCode: 429
			};
		});
	}
	const response = {
		statusCode: 200,
		body: JSON.stringify({prices: results})
	}
	return response;
}