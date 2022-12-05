module.exports.getCustomersByUserId = (userId, options) => {
  return {
    KeyConditionExpression: '#userIdIdx = :userId',
    IndexName: 'userIdIdx',
    ExpressionAttributeNames: {
      '#userIdIdx': 'userId',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    TableName: 'customers-table',
    ProjectionExpression: 'fullName, last_trans_date,other_details,last_trans_amount,createdAt,address,email ,last_trans_id, balance, image, userId,id, phone ',

    // ProjectionExpression: ['last_trans_date', 'other_details', 'last_trans_amount', 'createdAt', 'address', 'email', 'name', 'last_trans_id', 'balance', 'image', 'userId', 'id', 'phone'],
  };
};
