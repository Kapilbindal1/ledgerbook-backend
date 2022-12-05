// bb = JSON.stringify({
//   message: 'Added successfully',
//   status: 200,
//   customerId: customerId,
// });

module.exports.sendSuccessResponse = (body) => {
  return {
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
    },
    statusCode: 200,
    body: body,
  };
};

module.exports.sendFailureResponse = (body) => {
  return {
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
    },
    statusCode: 400,
    body: body,
  };
};
