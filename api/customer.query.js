module.exports.getCustomersByUserId = (userId, options) => {
  return {
    KeyConditionExpression: "#userIdIdx = :userId",
    IndexName: "userIdIdx",
    ExpressionAttributeNames: {
      "#userIdIdx": "userId",
    },
    FilterExpression: "isDeleted = :isDeleted",
    ExpressionAttributeValues: {
      ":userId": userId,
      ":isDeleted": false,
    },
    TableName: process.env.CUSTOMERS_TABLE,
    ProjectionExpression: "fullName, last_trans_date,other_details,last_trans_amount,createdAt,address,email ,last_trans_id, balance, image, userId,id, phone, creditLimit, defaultTransactionAmt",

    // ProjectionExpression: ['last_trans_date', 'other_details', 'last_trans_amount', 'createdAt', 'address', 'email', 'name', 'last_trans_id', 'balance', 'image', 'userId', 'id', 'phone'],
  };
};

module.exports.getCustomerByCustomerId = (id, options) => {
  const getParams = {
    TableName: process.env.CUSTOMERS_TABLE,
    FilterExpression: "isDeleted = :isDeleted",
    Key: {
      id: id,
    },
    ExpressionAttributeValues: {
      ":isDeleted": false,
    },
  };
  return getParams;
};
