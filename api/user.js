const AWS = require('aws-sdk');
var md5 = require('md5');
require('dotenv').config();
const {sendSuccessResponse, sendFailureResponse} = require('../utils');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const parameters = require('../dynamo/parameters');
var sns = new AWS.SNS({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const hashPassword = async (password) => {
  console.log('passwordpassword', password);
  const hash = await md5(password);

  if (hash) return hash;
};
const updateOtpTable = async (OTP, phoneNumber) => {
  console.log('update otp table');
  const params = {
    TableName: 'otp-table',
    Key: {
      phoneNo: phoneNumber,
    },
  };
  const result = await dynamoDb.get(params).promise();
  if (result) {
    const params = {
      TableName: 'otp-table',
      Key: {
        phoneNo: phoneNumber,
      },
      UpdateExpression: 'SET otp = :otp, createdAt = :createdAt',
      ExpressionAttributeValues: {
        ':otp': OTP,
        ':createdAt': Date.now(),
      },
    };

    let updatedOtpTableData = await dynamoDb.update(params).promise();
    console.log('updatedOtpTableDataresponse', updatedOtpTableData);
  } else {
    const params = {
      TableName: 'otp-table',
      Item: {otp: OTP, mobileNo: phoneNumber, createdAt: Date.now()},
    };
    await dynamoDb.put(params).promise();
  }
  console.log('ppppresponseresponse', result);
  const body = JSON.stringify({message: 'OTP send successfully', otp: OTP, status: 200});
  return sendSuccessResponse(body);
};

module.exports.checkContent = (event) => {
  const parametersReceived = JSON.parse(event.body);
  console.log('checkContentcheckContent', parametersReceived, 'queryStringParameters', event.queryStringParameters, 'pathParameters', event.pathParameters);
  const body = JSON.stringify({message: 'check checked', status: 200});
  return sendSuccessResponse(body);
};

module.exports.createUser = async (event) => {
  try {
    const parametersReceived = JSON.parse(event.body);
    const idHash = await hashPassword(parametersReceived.phoneNo);
    const passwordHash = await hashPassword(parametersReceived.password);
    parametersReceived.id = idHash;
    parametersReceived.ownerId = parametersReceived?.ownerId || 'null';
    parametersReceived.createdAt = Date.now();

    const {phoneNo} = parametersReceived;
    console.log('parametersReceived11', parametersReceived);
    const phoneNumber = `+91${phoneNo}`;
    console.log('phoneNumber', phoneNumber);

    parametersReceived.password = passwordHash;
    parametersReceived.phoneNo = phoneNumber;
    const ifUser = await checkIfUserAlreadyExist(phoneNumber);
    console.log('ifUserifUser', ifUser);
    if (ifUser && ifUser?.Items.length) {
      const body = JSON.stringify({
        error: 'User already exist',
        status: 400,
        // user: ifUser.Items[0],
      });
      return sendFailureResponse(body);
    }
    console.log('parametersReceived', parametersReceived);
    const params = {
      TableName: 'users-table',
      Item: parametersReceived,
    };
    const result = await dynamoDb.put(params).promise();
    console.log('resultresult', result);
    // Call DynamoDB to add the item to the table
    const getUserParams = {
      TableName: 'users-table',
      Key: {
        id: idHash,
      },
      // AttributesToGet: ['id'],
    };
    const userData = await dynamoDb.get(getUserParams).promise();
    console.log('userData', userData);
    if (userData) {
      delete userData.Item['password'];
    }
    body = JSON.stringify({
      message: 'Added successfully',
      status: 200,
      user: userData.Item,
    });
    if (result) {
      console.log('Body==>', body);
      return sendSuccessResponse(body);
    } else {
      sendFailureResponse("Couldn't add user details.");
      // callback(new Error("Couldn't add user details."));
    }
  } catch (err) {
    const body = JSON.stringify({error: 'User cannot be created', status: 400});
    response = sendFailureResponse(body);
  }
};

function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

const sendOtpMessage = async (response, phoneNumber) => {
  var OTP = generateRandomNumber(1000, 9999);
  var snsParams = {
    Message: `Your mobile verification code is: ${OTP}`,
    PhoneNumber: phoneNumber,
    MessageAttributes: {'AWS.SNS.SMS.SMSType': {DataType: 'String', StringValue: 'Transactional'}},
  };
  console.log('responseresponse', response);

  // if sns service active
  if (process.env.environment === 'PROD') {
    const res = await new Promise((resolve, reject) => {
      sns.publish(snsParams, async (err, data) => {
        if (err) {
          console.log('error-> ' + err + '-' + phoneNumber + '-' + JSON.stringify(snsParams.params));
          response = {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
            },
            statusCode: 400,
            body: JSON.stringify({error: 'Something went wrong', otp: OTP, status: 400}),
          };
          resolve(response);
        } else {
          const res = updateOtpTable(OTP, phoneNumber);
          resolve(res);
        }
      });
    });
    return res;
  } else {
    console.log('dev environment');
    const res = updateOtpTable(OTP, phoneNumber);
    return res;
  }
};

const checkIfUserAlreadyExist = async (phoneNumber) => {
  const userParams = {
    TableName: 'users-table',
    FilterExpression: 'phoneNo = :phoneNo',
    ExpressionAttributeValues: {
      ':phoneNo': phoneNumber,
    },
  };
  const userData = await dynamoDb.scan(userParams).promise();
  return userData;
};

module.exports.getUser = async (event, context) => {
  const {phoneNo} = event.queryStringParameters;
  const phoneNumber = `+91${phoneNo.trim()}`;
  let response = {};
  const userData = checkIfUserAlreadyExist(phoneNumber);
  if (userData && userData?.Items.length) {
    const body = JSON.stringify({message: 'user found successfully', user: userData.Items[0], status: 200});
    response = sendSuccessResponse(body);
  } else {
    const body = JSON.stringify({error: 'user not found', status: 400});
    response = sendFailureResponse(body);
  }
  return response;
};

module.exports.sendOtp = async (event, context) => {
  let response = {};

  if (!event.queryStringParameters) {
    const body = JSON.stringify({error: 'please send phone number to login', status: 400});
    response = sendFailureResponse(body);
  } else {
    const {phoneNo} = event.queryStringParameters;
    console.log('phoneNophoneNo', phoneNo);
    if (phoneNo && phoneNo.length === 10) {
      const phoneNumber = `+91${phoneNo.trim()}`;
      console.log('process.env.AWS_DEFAULT_REGION', process.env.ACCESS_KEY_ID, process.env.REGION);
      const snsResponse = await sendOtpMessage(response, phoneNumber);
      response = snsResponse;
    } else {
      body = JSON.stringify({error: 'Phone no not correct', status: 400});
      response = sendFailureResponse(body);
    }
    return response;
  }
};

module.exports.validateUser = async (event, context, callback) => {
  try {
    const parametersReceived = JSON.parse(event.body);
    const {otp, phoneNo} = parametersReceived;
    console.log('parametersReceived11', otp);
    const phoneNumber = `+91${phoneNo.trim()}`;

    const otpParams = {
      TableName: 'otp-table',
      FilterExpression: 'phoneNo = :phoneNo',
      ExpressionAttributeValues: {
        ':phoneNo': phoneNumber,
      },
    };
    console.log('otpData', otpParams);

    var usersResult;
    // Do scan
    otpResult = await dynamoDb.scan(otpParams).promise();
    console.log('otpResult', otpResult);

    if (otpResult?.Items.length) {
      if (otpResult.Items[0].otp === otp) {
        var currentTime = new Date(Date.now());
        var otpTime = new Date(otpResult?.Items[0].createdAt);
        console.log('otpTime', otpTime, currentTime);
        var difference = currentTime.getTime() - otpTime.getTime();
        var minutesDifference = Math.floor(difference / 1000 / 60);
        difference -= minutesDifference * 1000 * 60;
        console.log('otpTime', otpTime, difference, minutesDifference);

        if (minutesDifference >= 10) {
          body = JSON.stringify({
            error: 'OTP expired',
            status: 401,
            user: {},
          });
          return sendFailureResponse(body);
          // return {
          //   headers: {
          //     'Access-Control-Allow-Headers': 'Content-Type',
          //     'Access-Control-Allow-Origin': '*',
          //     'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
          //   },
          //   statusCode: 401,
          //   body: JSON.stringify({
          //     error: 'OTP expired',
          //     status: 401,
          //     user: {},
          //   }),
          // };
        }

        const userParams = {
          TableName: 'users-table',
          FilterExpression: 'phoneNo = :phoneNo',
          ExpressionAttributeValues: {
            ':phoneNo': phoneNumber,
          },
        };

        usersResult = await dynamoDb.scan(userParams).promise();

        //use getuser here
        console.log('usersResultusersResult', usersResult);
        if (usersResult?.Items.length) {
          delete usersResult.Items[0]['password'];
          const body = JSON.stringify({
            message: 'Validated successfully',
            status: 200,
            user: usersResult?.Items[0],
          });
          return sendSuccessResponse(body);
        } else {
          const body = JSON.stringify({
            message: 'Validated successfully',
            status: 200,
            user: {},
          });
          return sendSuccessResponse(body);
        }
      } else {
        const body = JSON.stringify({
          error: 'OTP not correct',
          status: 400,
        });
        return sendFailureResponse(body);
      }
    } else {
      const body = JSON.stringify({
        error: 'Either phone no or otp not correct',
        status: 400,
        user: {},
      });
      return sendSuccessResponse(body);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    body = JSON.stringify({
      error: 'Couldnt retrieve user details.',
      status: 400,
    });
    return sendFailureResponse(body);
    // callback(new Error("Couldn't retrieve user details."));
  }
};
// module.exports.getUser = async (event, context, callback) => {
//   console.log('event.pathParameters', event.queryStringParameters);
//   const {email, password} = event.queryStringParameters;
//   const idHash = await hashPassword(email);

//   const params = {
//     TableName: 'users-table',
//     Key: {
//       id: idHash,
//     },
//   };
//   console.log('paramsparams', params);

//   var response;
//   try {
//     const result = await dynamoDb.get(params).promise();
//     const passwordHash = await hashPassword(password);
//     console.log('passwordHash', passwordHash, result);
//     if (Object.keys(result).length > 0) {
//       if (passwordHash === result.Item.password) {
//         console.log('password matched', result);
//         const response = {
//           headers: {
//             'Access-Control-Allow-Headers': 'Content-Type',
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
//           },
//           statusCode: 200,
//           body: JSON.stringify(result.Item),
//         };
//         callback(null, response);
//       } else {
//         response = {
//           headers: {
//             'Access-Control-Allow-Headers': 'Content-Type',
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
//           },
//           statusCode: 400,
//           body: JSON.stringify({error: 'user not found'}),
//         };
//       }
//     } else {
//       response = {
//         headers: {
//           'Access-Control-Allow-Headers': 'Content-Type',
//           'Access-Control-Allow-Origin': '*',
//           'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
//         },
//         statusCode: 400,
//         body: JSON.stringify({error: 'user not found'}),
//       };
//     }
//   } catch (err) {
//     console.error('Fetch error:', err);
//     callback(new Error("Couldn't retrieve user details."));
//   }
//   callback(null, response);
// };

module.exports.updateUser = async (event, context, callback) => {
  const data = JSON.parse(event.body);
  console.log('datadata', data);

  let attr = {};
  let nameobj = {};
  let exp = 'SET ';
  let arr = Object.keys(data);
  let attrname = {};

  arr.map((key) => {
    attr[`:${key}`] = data[key];
  });

  arr.map((key) => {
    exp += `${key} = :${key},`;
  });

  arr.map((key) => {
    nameobj[`#${key}`] = data[key];
  });
  arr.map((key) => {
    attrname[`#${key}`] = data[key];
  });

  // attrname = {
  //   [Object.keys(nameobj)[0]]: nameobj[Object.keys(nameobj)[0]],
  // };

  exp = exp.slice(0, -1);
  console.log('attrname', attrname, attr, exp);

  const params = {
    TableName: 'users-table',
    Key: {
      id: event.pathParameters.id,
    },
    ExpressionAttributeNames: attrname,
    ExpressionAttributeValues: attr,
    UpdateExpression: exp,
    ReturnValues: 'ALL_NEW',
  };
  // update the todo in the database
  dynamoDb.update(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: {'Content-Type': 'text/plain'},
        body: "Couldn't update the card",
      });
      return;
    }

    // create a response
    const response = {
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
      },
      statusCode: 200,
      body: JSON.stringify(result.Attributes),
    };
    callback(null, response);
  });
};

module.exports.sendEmail = function (req, res) {
  const parametersReceived = JSON.parse(req.body);
  const {text, htmlText, subject} = parametersReceived;

  if (!htmlText && !text) {
    return {
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
      },
      statusCode: 200,
      body: JSON.stringify({success: false, message: 'Invalid data.'}),
    };
  }
  console.log('htmlTexthtmlText', process.env.SEND_GRID_API_KEY, htmlText);

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
  const msg = {
    to: 'kbindal@innow8apps.com', // Change to your recipient
    from: 'contact@innow8apps.com', // Change to your verified sender
    cc: 'bbhatia@innow8apps.com',
    subject: subject || 'Email from Innow8 site',
    text: text || '',
    html: htmlText || '',
  };
  console.log('sgMailsgMail', sgMail);
  return sgMail
    .send(msg)
    .then(() => {
      console.log('Email sent');
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
        },
        statusCode: 200,
        body: JSON.stringify({success: true, message: 'Email sent.'}),
      };
    })
    .catch((error) => {
      console.error(error);
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST, GET',
        },
        statusCode: 200,
        body: JSON.stringify(error),
      };
    });
};
