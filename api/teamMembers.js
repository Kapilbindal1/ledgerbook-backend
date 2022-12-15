const AWS = require('aws-sdk');
const {sendSuccessResponse, sendFailureResponse} = require('../utils');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getTeamMembersByUserId = (ownerId, options) => {
  console.log('ownerIdownerId', ownerId);
  return {
    KeyConditionExpression: '#ownerIdIdx = :ownerId',
    IndexName: 'ownerIdIdx',
    ExpressionAttributeNames: {
      '#ownerIdIdx': 'ownerId',
    },
    ExpressionAttributeValues: {
      ':ownerId': ownerId,
    },
    TableName: 'users-table',
  };
};

module.exports.getTeamMembers = async (event) => {
  const {id} = event.pathParameters;
  const params = getTeamMembersByUserId(id);
  const userData = await dynamoDb.query(params).promise();

  const body = JSON.stringify({
    status: 200,
    message: 'Team members fetched successfully',
    data: userData?.Items || [],
  });
  response = sendSuccessResponse(body);
  return response;
};
