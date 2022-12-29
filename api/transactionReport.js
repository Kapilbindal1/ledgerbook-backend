const {sendSuccessResponse, sendFailureResponse} = require("../utils");
const AWS = require("aws-sdk");
var ddb = new AWS.DynamoDB({apiVersion: "2012-08-10"});
const PDFDocument = require("pdfkit-table");
const fs = require("fs");
const moment = require("moment");

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({
  // apiVersion: '2006-03-01',
  // signatureVersion: 'v2',
  region: "ap-south-1",
  accessKeyId: "AKIAXKR26MDHMWBO2352",
  secretAccessKey: "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",
});

function generateHeader(doc) {
  doc.image("logo.png", 50, 45, {width: 50}).fillColor("#444444").fontSize(20).text("Ledgerbook Inc.", 110, 57).moveDown();

  //   doc.image('logo.png', 50, 45, {width: 50}).fillColor('#444444').fontSize(20).text('Ledgerbook Inc.', 110, 57).fontSize(10).text(`Name: ${customer.fullName}`, 200, 65, {align: 'right'}).text(`Address: ${customer.address}`, 200, 80, {align: 'right'}).moveDown().text(`Phone: ${customer.phone}`, 200, 100, {align: 'right'}).moveDown();
}
const createPdf = async (items, type) => {
  try {
    // const customersArr = items.map((item) => item.customerId);

    const newArr = [];

    const columns = [
      {label: "Date", property: "date", headerColor: "#2C53D6", headerOpacity: 0.5},
      {label: "Customer Name", property: "name", headerColor: "#FF0000", headerOpacity: 0.5},
      {label: "Debit", property: "debit", headerColor: "#2C53D6", headerOpacity: 0.5},
      {label: "Credit", property: "credit", headerColor: "#FF0000", headerOpacity: 0.5},
      {label: "Balance", property: "balance", headerColor: "#2C53D6", headerOpacity: 0.5},
    ];

    items.map((item) => {
      console.log("itemitemitem", item);
      const arr = [];
      const createdAt = item["createdAt"];
      const date = moment(createdAt).format("DD/MM/YYYY");
      arr.push(date);
      arr.push(item["customerName"]);

      const amount = item["amount"].toLocaleString();
      const updatedBalance = item["updatedBal"].toLocaleString();

      if (item.type === "DEBIT") {
        arr.push(amount);
      } else {
        arr.push(0);
      }
      if (item.type === "CREDIT") {
        arr.push(amount);
      } else {
        arr.push(0);
      }
      arr.push(updatedBalance);

      console.log("arrarrarr", arr);
      newArr.push(arr);
    });
    let doc = new PDFDocument({margin: 20, size: "A4"});
    generateHeader(doc); // Invoke `generateHeader` function.

    // doc.pipe(fs.createWriteStream('./document.pdf'));

    const table = {
      title: {label: "Transactions", fontSize: 20, color: "#2C53D6"},
      headers: columns,
      divider: {
        header: {disabled: true},
        horizontal: {disabled: false, width: 1, opacity: 1},
        padding: 15,
        columnSpacing: 10,
      },
      options: {
        width: 300,
      },

      rows: newArr,
    };
    await doc.table(table, {
      width: 100,
      columnsSize: [80, 80, 80, 80, 80],
    });

    doc.end();
    let path = `${Date.now()}.pdf`;

    return uploadToS3(type, doc, path);
  } catch (err) {
    console.log("errrrr", err);
  }
};

function generateFooter(doc) {
  doc.fontSize(10).text("Thank you for your business.", 50, 400, {align: "center", width: 500});
}
function generateTableRow(doc, y, c1, c2, c3, c4, c5, c6) {
  doc.fontSize(10).text(c1, 50, y).text(c2, 150, y).text(c3, 210, y, {width: 90, align: "right"}).text(c4, 270, y, {width: 90}).text(c5, 10, y, {align: "right"});
}
function generateInvoiceTable(doc, invoice) {
  let i,
    invoiceTableTop = 150;
  generateTableRow(doc, invoiceTableTop, "Amount", "Created At", "Type", "Mode", "Balance");

  for (i = 0; i < invoice.length; i++) {
    const item = invoice[i];
    const position = invoiceTableTop + (i + 1) * 30;
    generateTableRow(doc, position, item.amount, new Date(item.createdAt).toLocaleString(), item.type, item.mode, item.updatedBal);
  }
}

function createInvoice(type, invoice, path) {
  let doc = new PDFDocument();
  generateHeader(doc); // Invoke `generateHeader` function.

  generateInvoiceTable(doc, invoice);
  generateFooter(doc); // Invoke `generateFooter` function.

  doc.end();
  return uploadToS3(type, doc, path, invoice);
}

const getIdsArr = (userIds) => {
  let idStr = "";

  if (Array.isArray(userIds)) {
    userIds.forEach((id, index) => {
      if (index === userIds.length - 1) {
        idStr = idStr + "'" + id + "'";
      } else {
        idStr += "'" + id + "',";
      }
    });
  } else {
    idStr += "'" + userIds + "'";
  }
  return idStr;
};
const getTransactionsByUserIds = async (userIds, queryStringParameters) => {
  try {
    // if (Array.isArray(userIds)) {
    //   userIds.forEach((id, index) => {
    //     if (index === userIds.length - 1) {
    //       idStr = idStr + "'" + id + "'";
    //     } else {
    //       idStr += "'" + id + "',";
    //     }
    //   });
    // } else {
    //   idStr += "'" + userIds + "'";
    // }
    const idStr = getIdsArr(userIds);
    const tableName = process.env.TRANSACTIONS_TABLE;

    let str = "";
    if (queryStringParameters?.fromDate && queryStringParameters?.toDate) {
      const {fromDate, toDate} = queryStringParameters;
      const fromDateVal = parseInt(fromDate);
      const toDateVal = parseInt(toDate);
      const tableName = process.env.TRANSACTIONS_TABLE;
      // str = 'SELECT createdAt, type, customerName, amount,updatedBal  FROM "transactions-prod" WHERE "userId" IN [' + idStr + "] and createdAt BETWEEN " + fromDateVal + " and " + toDateVal + "";
      str = `SELECT createdAt, type, customerName, amount,updatedBal  FROM "${tableName}" WHERE "userId" IN [${idStr}] and createdAt BETWEEN ${fromDateVal} and ${toDateVal}`;
    } else {
      str = `SELECT createdAt, type,customerName, amount ,updatedBal FROM "${tableName}" WHERE "userId" IN [${idStr}]`;
    }
    console.log("pppppp", str);
    const {Items = []} = await ddb
      .executeStatement({
        Statement: str,
      })
      .promise();
    const userTransactions = Items.map(AWS.DynamoDB.Converter.unmarshall);
    console.log("userTransactionsuserTransactions", userTransactions);
    return userTransactions;
  } catch (err) {
    const body = JSON.stringify({
      status: 400,
      error: err,
    });
    return sendFailureResponse(body);
  }
};

const getReportsByDateRange = (userId, fromDate, toDate) => {
  let object = {
    KeyConditionExpression: "#userIdIdx = :userId AND createdAt BETWEEN :from_time and :to_time",
    IndexName: "userIdIdx",
    ExpressionAttributeNames: {
      "#userIdIdx": "customerId",
    },
    ExpressionAttributeValues: {
      ":userId": userId,
      ":from_time": parseInt(fromDate),
      ":to_time": parseInt(toDate),
    },
    TableName: process.env.TRANSACTIONS_TABLE,
    // Limit: 1,
  };
  return object;
};
const uploadToS3 = (type, doc, path) => {
  try {
    var s3params = {
      Bucket: "ledgerbook-transaction-assets",
      Key: path,
      Body: doc,
      CacheControl: "public, max-age=86400",
    };
    console.log("uploadToS3");
    let response = new Promise((resolve, reject) => {
      let res = {};
      s3.upload(s3params, function (err, data) {
        if (err) {
          const body = JSON.stringify({
            status: 400,
            error: err,
          });
          res = sendFailureResponse(body);
        } else {
          const body = JSON.stringify({
            message: `${type} returned successfully`,
            status: 200,
            link: data.Location,
          });
          res = sendSuccessResponse(body);

          // next(null, filePath);
        }
        resolve(res);
      });
    });
    return response;
  } catch (err) {
    console.log("errrr", err);
  }
};
const getandSendTransactions = async (ids, queryStringParameters, docType) => {
  const allTransactions = await getTransactionsByUserIds(ids, queryStringParameters);
  console.log("allTransactions111", allTransactions, Array.isArray(allTransactions));
  if (Array.isArray(allTransactions)) {
    return getDocOfTransactions(docType, allTransactions);
  } else {
    return allTransactions;
  }
};

const convertToCsv = (data) => {
  console.log("datadata", data);
  //   const csvRows = [];
  //   const headers = Object.keys(data[0]);
  const headers = ["createdAt", "customerName", "debit", "credit", "balance"];
  //   csvRows.push(headers.join(','));
  //   console.log('csvRowscsvRows', csvRows);
  const csvRows = ["Date,Customer Name,Debit,Credit,Balance"];
  for (const row of data) {
    const values = headers.map((header) => {
      let val = row[header] || "";

      if (header === "createdAt") {
        const date = moment(row[header]).format("DD/MM/YYYY");
        val = date;
      }
      if (header === "debit") {
        if (row["type"] === "DEBIT") {
          val = row["amount"];
        } else {
          val = 0;
        }
      }
      if (header === "credit") {
        if (row["type"] === "CREDIT") {
          val = row["amount"];
        } else {
          val = 0;
        }
      }
      if (header === "balance") {
        val = row["updatedBal"];
      }

      return `"${val}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
};

const getDocOfTransactions = (docType, transData) => {
  if (transData && transData?.length) {
    if (docType === "csv") {
      let path = `${Date.now()}.csv`;
      const file = convertToCsv(transData);
      return uploadToS3(docType, file, path);
    } else {
      let path = `${Date.now()}.pdf`;
      return createPdf(transData, docType);
      //   return createInvoice(docType, transData, path);
    }
  } else {
    const body = JSON.stringify({
      message: "Transactions not found",
      status: 200,
    });
    return sendSuccessResponse(body);
  }
};

const getAllOwnerTransactions = async (event, docType) => {
  try {
    const ownerId = event.queryStringParameters?.ownerId;

    const params = getTeamMembersByOwnerId(ownerId);
    const allTeamMembersOfOwner = await dynamoDb.query(params).promise();
    console.log("allTeamMembersOfOwner", allTeamMembersOfOwner);
    if (allTeamMembersOfOwner && allTeamMembersOfOwner?.Items?.length) {
      const teamMemberIds = allTeamMembersOfOwner.Items.map((item) => item.id);
      teamMemberIds.push(ownerId);
      return getandSendTransactions(teamMemberIds, event.queryStringParameters, docType);
    } else {
      return getandSendTransactions(ownerId, event.queryStringParameters, docType);
    }
  } catch (err) {
    console.log("eeeeee", err);
  }
};

module.exports.getTransactionsReport = async (event, context, callback) => {
  const {docType = "csv", type} = event.queryStringParameters;

  //   const customerParams = {
  //     TableName: 'customers-table',
  //     Key: {
  //       id: customerId,
  //     },
  //   };
  try {
    var response;

    if (type === "all") {
      if (!event.queryStringParameters?.ownerId) {
        const body = JSON.stringify({
          message: "owner id not found",
          status: 400,
        });
        return sendFailureResponse(body);
      } else {
        return getAllOwnerTransactions(event, docType);
      }
    } else {
      const userId = event.queryStringParameters?.type;
      console.log("userIduserId", userId);

      return getandSendTransactions(userId, event.queryStringParameters, docType);
    }

    // if (event.queryStringParameters.fromDate) {
    //   const {toDate = Date.now(), fromDate} = event.queryStringParameters;
    //   params = getReportsByDateRange(customerId, fromDate, toDate);
    // }
    // const transData = await dynamoDb.query(params).promise();
  } catch (err) {
    console.log("errerr", err);
    const body = JSON.stringify({
      status: 400,
      error: err,
    });
    return sendFailureResponse(body);
  }
};

const getTeamMembersByOwnerId = (ownerId, options) => {
  console.log("ownerIdownerId", ownerId);
  return {
    KeyConditionExpression: "#ownerIdIdx = :ownerId",
    IndexName: "ownerIdIdx",
    ExpressionAttributeNames: {
      "#ownerIdIdx": "ownerId",
    },
    ExpressionAttributeValues: {
      ":ownerId": ownerId,
    },
    TableName: process.env.USERS_TABLE,
    ProjectionExpression: "id,ownerId",
  };
};
