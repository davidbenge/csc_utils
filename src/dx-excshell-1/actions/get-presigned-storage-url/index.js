/*
* <license header>
*/

/**
 * This will take in some params and return a presigned url
 */


const fetch = require('node-fetch')
const { Core, Files } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action get-presigned-url')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = [filePath,fileName]
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // extract the user Bearer token from the Authorization header
    //const token = getBearerToken(params)
    if(!params.expiryInSeconds){
      params.expiryInSeconds = 7200 //two hours
    }

    if(!params.permissions){
      params.permissions = 'r'
    }

    if(params.filePath.length < 5){
      return errorResponse(400, "you need to specify a path IE myFolder/test/", logger)
    }
    if(params.filePath.startsWith("/")){
      params.filePath = params.filePath.substr(1)
    }
    if(!params.filePath.endsWith("/")){
      params.filePath = `${params.filePath}/`
    }

    if(params.filePath.fileName < 3){
      return errorResponse(400, "you need to specify a fileName", logger)
    }

    let response = {
      statusCode: 200,
      body: {
        presignedPath:`${params.filePath}${params.fileName}`,
        expiryInSeconds: params.expiryInSeconds,
        permissions: params.permissions
      }
    }

    const files = await filesLib.init()
    const preSignUrl = await files.generatePresignURL(`${params.filePath}${params.fileName}`, { expiryInSeconds: params.expiryInSeconds, permissions: params.permissions })
    response.body.presignedUrl = preSignUrl
    
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
