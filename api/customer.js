const AWS = require('aws-sdk');
var md5 = require('md5');
const {getCustomersByUserId} = require('./customer.query');
const {sendSuccessResponse, sendFailureResponse} = require('../utils');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.createCustomer = async (event) => {
  const parametersReceived = JSON.parse(event.body);
  const {fullName} = parametersReceived;
  const customerId = md5(fullName);
  parametersReceived.id = customerId;
  parametersReceived.createdAt = Date.now();
  parametersReceived.balance = parametersReceived?.balance || 0;
  console.log('parametersReceived11', parametersReceived);

  const params = {
    TableName: 'customers-table',
    Item: parametersReceived,
  };
  const result = await dynamoDb.put(params).promise();
  console.log('resultresult', result);
  const body = JSON.stringify({
    message: 'Added successfully',
    status: 200,
    customerId: customerId,
  });
  if (result) {
    return sendSuccessResponse(body);
  } else {
    sendFailureResponse("Couldn't add customer details.");
  }
};

module.exports.getCustomers = async (event, context, callback) => {
  let response = {};
  console.log('event.pathParameters', event.pathParameters.id);
  const {id} = event.pathParameters;

  const params = getCustomersByUserId(id);
  if (event.queryStringParameters?.search && event.queryStringParameters?.search !== '') {
    params.ExpressionAttributeNames = {...params.ExpressionAttributeNames, '#fullName': 'fullName'};
    params.FilterExpression = 'contains(#fullName, :fullName)';
    params.ExpressionAttributeValues = {...params.ExpressionAttributeValues, ':fullName': event.queryStringParameters.search.toLowerCase()};
  }
  console.log(params, 'fjdskfjd');

  const data = await dynamoDb.query(params).promise();
  console.log('datadata', data);
  if (data?.Items.length) {
    console.log('datadatadatadata');
    const body = JSON.stringify({data: data.Items, status: 200});
    response = sendSuccessResponse(body);
  } else {
    const body = JSON.stringify({
      status: 200,
      error: 'No customer with this user Id',
      data: [],
    });
    response = sendSuccessResponse(body);
  }

  callback(null, response);
};
