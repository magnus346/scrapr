const cheerio = require("cheerio");
const unirest = require("unirest");
const { LambdaClient, UpdateFunctionConfigurationCommand } = require("@aws-sdk/client-lambda");

// Mcwf9Ia47w57 EDy6DmqZGJEUfjdNl92 Lu0ly ghp

const selectRandomUserAgent = () => {
    const userAgents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"]
    const randomNumber = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomNumber];
}

const scraper = async(lang, country, keyword, page) => {
	
	if(keyword=='restart' && page==429)
		throw new Error('Recaptcha');
		
	let p = 10*(page-1);
	let url = 'https://www.google.com/search?hl='+lang+'&as_epq=&as_oq=&as_eq=&as_nlo=&as_nhi=&lr=lang_'+lang+'&as_qdr=all&as_sitesearch=&as_occt=any&as_filetype=&tbs=&start='+p+'&as_q='+keyword;
	return unirest
	.get(url)
	.headers({
		"Referer": "https://www.google.com",
		"User-Agent": selectRandomUserAgent()
	})
	.then((response) => {
		let $ = cheerio.load(response.body);

		let results = [];
		
		if($(".g-recaptcha").length) {
			throw new Error('Recaptcha');
		}
		
		$("a[href]:has(h3)").each((i,el) => {			
			if($(el).attr('href').startsWith('/') === false) {
				results.push({
					url: $(el).attr('href'),
					title: $(el).find('h3').first().text()
				})
			}
		})
		
		return results;
	});
	
}

const default_handler = async () => {
	return {
		statusCode: 200,
		body: JSON.stringify({_rt: process.env.RESTART_TIME})
	};	
}

const scraper_handler = async (locale, keyword, page) => {
	try {
		const locale_split = locale.trim().split('-');
		const lang = typeof locale_split[0] !== "undefined" ? locale_split[0] : 'fr';
		const country = typeof locale_split[1] !== "undefined" ? locale_split[1].toUpperCase() : lang.toUpperCase();
		const scraper_data = await scraper(lang, country, keyword, page);
		return {
			statusCode: 200,
			body: JSON.stringify({results: scraper_data})
		};
	} catch(error) {
		console.log(error);
		const lambda = new LambdaClient({region: 'eu-west-3', accessKeyId: process.env.USER_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.USER_AWS_SECRET_ACCESS_KEY});
		const command = new UpdateFunctionConfigurationCommand({
		  FunctionName: 'scrapr',
		  Environment: {
			Variables: {
			  'USER_AWS_ACCESS_KEY_ID': process.env.USER_AWS_ACCESS_KEY_ID,
			  'USER_AWS_SECRET_ACCESS_KEY': process.env.USER_AWS_SECRET_ACCESS_KEY,
			  'RESTART_TIME': Date.now().toString()
			}
		  }
		});
		lambda.send(command);
		return {
			statusCode: 429
		};
	}	
}

exports.handler = async (event) => {
	if(event.pathParameters && typeof event.pathParameters.locale !== "undefined" && typeof event.pathParameters.keyword !== "undefined" && typeof event.pathParameters.page !== "undefined")
		return scraper_handler(event.pathParameters.locale, event.pathParameters.keyword, event.pathParameters.page);
	return default_handler();
}