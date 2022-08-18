/*
* <license header>
*/

/**
 * This will expose a presigned url to map to an aem file
 */


const fetch = require('node-fetch')
const { Core, State } = require('@adobe/aio-sdk')
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
    const requiredParams = ['aemFilePath']
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

    logger.info(`params.aemFilePath.length ${params.aemFilePath.length}`)
    if(params.aemFilePath.length < 2){
      return errorResponse(400, "you need to specify an AEM file path aemFilePath IE /assets/myFolder/test/file.jpg", logger)
    }
    if(!params.aemFilePath.startsWith("/")){
      return errorResponse(400, "you need to specify an AEM file path aemFilePath IE /assets/myFolder/test/file.jpg", logger)
    }

    const randMin = 25
    const randMax = 100
    const randomLength = Math.floor(Math.random() * (randMax - randMin)) + randMin + 1
    const preSignUrl = `/api/v1/web/dx-excshell-1/${Math.random().toString(16).substr(2, randomLength)}`;
    let presignedData = {
      aemFilePath:`${params.aemFilePath}`,
      expiryInSeconds: params.expiryInSeconds,
      permissions: params.permissions,
      preSignUrl: `${preSignUrl}`
    }

    let response = {
      statusCode: 200,
      body: presignedData
    }

    //store this data in state store to be used by presigned endpoint
    const state = await State.init()
    await state.put(encodeURIComponent(preSignUrl), presignedData, { ttl: params.expiryInSeconds }) // -1 for no expiry, defaults to 86400 (24 hours)
    
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
