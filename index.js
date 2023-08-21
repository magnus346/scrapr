const axios = require('axios');

exports.handler = async (event) => {
  const result = await axios.get('https://api.ipify.org/?format=json').catch(err => console.error(err))
  const response = {
    statusCode: 200,
    body: JSON.stringify("Hello from Lambda and Github : "+JSON.stringify(result.data)),
  }
  // test
  return response;
}