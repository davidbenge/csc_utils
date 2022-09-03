/*
* <license header>
*/

/**
 * This will move a received presigned presigned file from storage to AEM
 */


const fetch = require('node-fetch')
const { Core, Files, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action move-presigned-response-to-aem')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['aemFqdn','aemFilePath','cscUtilKey','aemFileName']
    const requiredHeaders = ['Authorization','x-api-key']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    //TODO: allow metadata to be applied
    // extract the user Bearer token from the Authorization header
    const token = params.__ow_headers.authorization
    const xApiKey = params.__ow_headers['x-api-key']
  
    if(!params.aemFilePath.startsWith('/content/dam/')){
      params.aemFilePath = `/content/dam/${params.aemFilePath}`
    }

    //Init storage
    const files = await Files.init()
    const state = await State.init()
    let processState = await state.get(params.cscUtilKey) // get the needed data from state
    if(processState){
      processState = processState.value
      logger.debug(`Got the csc Util key data ${JSON.stringify(processState,null,5)}`)
    }else{
      return errorResponse(400, `cscUtilKey data not found`, logger)
    }

    let response = {
      statusCode: 200,
      body: {
      }
    }

    //Create blank Asset and get block init
    // let blockUploadLink //var for block upload link
    // try{
    //   const createApiEndpoint = `https://${params.aemFqdn}/adobe/repository${params.aemFilePath};api=create;path=${params.aemFileName};mode=id`
    //   const createCallOptions = {
    //     method: 'post',
    //     headers: {
    //      "Authorization":token,
    //      "x-api-key":xApiKey
    //     }
    //   }
    //   const createRes = await fetch(createApiEndpoint,createCallOptions)
    //   if (!createRes.ok) {
    //     throw new Error('request to ' + createApiEndpoint + ' failed with status code ' + createRes.status)
    //   }

    //   // get the blockUploadApi
    //   logger.debug('headers')
    //   for (var pair of createRes.headers.entries()) {
    //     logger.debug(pair[0]+ ': '+ pair[1])
    //     if(pair[0] == 'link'){
    //       blockUploadLink = pair[1].match(/(?<=\<)(.*?)(?=\>)/g)[0] //get just the block upload url
    //     }
    //   }

    // }catch(errorMessage){
    //   return errorResponse(500, `Unable to create empty asset in target ${createApiEndpoint} :${errorMessage}`, logger)
    // }

    //processState.blockUploadLink = blockUploadLink //TEST
    response.body.processState = processState //TEST
    

    // GET THE FILE SPECS
    try{
      // NOT WORKING const filesProperties = files.getProperties("40434af8ab5775fd5e79f42c261cdff9/6d9ccee3-f019-4b1c-8f78-68d2c9edc763%2Ftest_result_ab4.jpeg")
      // response.body.filesProperties = filesProperties //TEST
      let fileList = await files.list('/') //TEST
      fileList.forEach(file =>{
        logger.debug(file)
        if(file.name == `${params.cscUtilKey}/${processState.preSignedData.fileName}`){
          logger.debug('FOUND FILE')
          response.body.filesProperties = file// TEST
        }
      })
      response.body.listTest = JSON.stringify(fileList) //TEST
      response.body.filesPropertiesPath = `${params.cscUtilKey}/${processState.preSignedData.fileName}` //TEST
    }catch(errorMessage){
      return errorResponse(500, `Unable to get file properties for ${params.cscUtilKey}${processState.preSignedData.fileName} :${errorMessage}`, logger)
    }    
    
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
