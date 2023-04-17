const AWS = require("aws-sdk");
const AWS_REGION = "us-east-1";
AWS.config.update({
  region: AWS_REGION,
});
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoDBTableName = "product-inventory";
// Resources(endpoints) created in API Gateway
const healthPath = "/health";
const productPath = "/product";
const productsPath = "/products";
exports.handler = async function (event) {
  try {
    console.log("Request event" + event);
    let response;
    switch (true) {
      case event.httpMethod === "GET" && event.path === healthPath:
        response = buildResponse(200);
        break;
      case event.httpMethod === "GET" && event.path === productPath:
        response = await getProduct(event.queryStringParameters.productId);
        break;
      case event.httpMethod === "GET" && event.path === productsPath:
        response = await getProducts();
        break;
      case event.httpMethod === "POST" && event.path === productPath:
        response = await saveProduct(JSON.parse(event.body));
        break;
      case event.httpMethod === "PATCH" && event.path === productPath:
        const requestBody = JSON.parse(event.body);
        response = await modifyProduct(
          requestBody.productId,
          requestBody.updateKey,
          requestBody.updateValue
        );
        break;
      case event.httpMethod === "DELETE" && event.path === productPath:
        response = await deleteProduct(JSON.parse(event.body).productId);
        break;
      default:
        response = buildResponse(404, "404 Not Found");
    }
    return response;
  } catch (err) {
    console.log("ERROR: ", err);
    return buildResponse(500, "Internal Server Error");
  }
};
// Get Specific Product
async function getProduct(productId) {
  try {
    const params = {
      TableName: dynamoDBTableName,
      Key: {
        productId: productId,
      },
    };
    const response = await dynamoDB.get(params).promise();
    return buildResponse(200, response.Item);
  } catch (err) {
    console.log("ERROR in Get Product: ", err);
    return buildResponse(500, "Internal Server Error");
  }
}

// Gets all products
async function getProducts() {
  try {
    const params = { TableName: dynamoDBTableName };
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
      products: allProducts,
    };
    return buildResponse(200, body);
  } catch (err) {
    console.log("ERROR in Get Products: ", err);
    return buildResponse(500, "Internal Server Error");
  }
}
async function scanDynamoRecords(scanParams, itemArray) {
  try {
    // Read Dynamo DB data, pushing into array
    const dynamoData = await dynamoDB.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);

    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (err) {
    console.log("ERROR in Scan Dynamo Records: ", err);
    throw err;
  }
}
// Add a Product
async function saveProduct(requestBody) {
  const params = {
    TableName: dynamoDBTableName,
    Item: requestBody,
  };

  try {
    await dynamoDB.put(params).promise();
    const body = {
      Operation: "SAVE",
      Message: "SUCCESS",
      Item: requestBody,
    };
    return buildResponse(200, body);
  } catch (error) {
    console.log("ERROR in Save Product: ", error);
    return buildResponse(500, { message: "Error in Save Product" });
  }
}

// Update a Product
async function modifyProduct(productId, updateKey, updateValue) {
  const params = {
    TableName: dynamoDBTableName,
    Key: {
      productId: productId,
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ":value": updateValue,
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const response = await dynamoDB.update(params).promise();
    const body = {
      Operation: "UPDATE",
      Message: "SUCCESS",
      UpdatedAttributes: response,
    };
    return buildResponse(200, body);
  } catch (error) {
    console.log("ERROR in Update Product: ", error);
    return buildResponse(500, { message: "Error in Update Product" });
  }
}

// Delete a Product
async function deleteProduct(productId) {
  const params = {
    TableName: dynamoDBTableName,
    Key: {
      productId: productId,
    },
    ReturnValues: "ALL_OLD",
  };

  try {
    const response = await dynamoDB.delete(params).promise();
    const body = {
      Operation: "DELETE",
      Message: "SUCCESS",
      Item: response,
    };
    return buildResponse(200, body);
  } catch (error) {
    console.log("ERROR in Delete Product: ", error);
    return buildResponse(500, { message: "Error in Delete Product" });
  }
}

// For specific response structure
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
