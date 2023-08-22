const axios = require('axios');
const cheerio = require("cheerio");
const unirest = require("unirest");

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
			$(".item_price").each((i,el) => {
				results.push({
					price: $(el).find(".price").first().attr("data-pricevalue"),
					currency: $(el).find(".price").first().attr("data-currency"),
					shipping: $(el).find(".item_shipping").first().text().replace(/\D/g,'').replace(/,/g,'.')
				})
			})
			return results;
		})
	}
}

exports.handler = async (event) => {
  //const ip = await axios.get('https://api.ipify.org/?format=json').catch(err => console.error(err))
  const { id } = event.pathParameters;
  const results = await scrapers.discogsPrices(id)
  const response = {
    statusCode: 200,
    body: JSON.stringify({prices: results}),
  }
  // test
  return response;
}