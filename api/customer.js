const AWS = require('aws-sdk');
var md5 = require('md5');
const {getCustomersByUserId} = require('./customer.query');
const {sendSuccessResponse, sendFailureResponse} = require('../utils');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const checkIfCustomerAlreadyExist = async (phoneNumber) => {
  const userParams = {
    TableName: 'customers-table',
    FilterExpression: 'phone = :phone',
    ExpressionAttributeValues: {
      ':phone': phoneNumber,
    },
  };
  const userData = await dynamoDb.scan(userParams).promise();
  return userData;
};

module.exports.createCustomer = async (event) => {
  try {
    const parametersReceived = JSON.parse(event.body);
    const {fullName, phone} = parametersReceived;
    // const customerId = md5(fullName);
    const customerId = await md5(phone);
    const phoneNumber = `+91${phone.trim()}`;

    const ifAlreadyCustomer = await checkIfCustomerAlreadyExist(phoneNumber);
    console.log('ifAlreadyCustomer', ifAlreadyCustomer);
    if (ifAlreadyCustomer && ifAlreadyCustomer?.Items.length) {
      const body = JSON.stringify({
        error: 'User already exist',
        status: 400,
        // customer: ifAlreadyCustomer.Items[0],
      });
      return sendFailureResponse(body);
    }
    parametersReceived.phone = phoneNumber;

    parametersReceived.id = customerId;
    parametersReceived.createdAt = Date.now();
    parametersReceived.balance = parametersReceived?.balance || 0;
    console.log('parametersReceived11', parametersReceived);
    if (!parametersReceived?.userId) {
      const body = JSON.stringify({
        error: 'userId is mandatory to send',
        status: 400,
      });
      return sendFailureResponse(body);
    }
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
  } catch (err) {
    const body = JSON.stringify({error: 'Customer cannot be created', status: 400});
    response = sendFailureResponse(body);
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
