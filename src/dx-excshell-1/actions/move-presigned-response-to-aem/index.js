/*
* <license header>
*/

/**
 * This will move a received presigned presigned file from storage to AEM
 */


const fetch = require('node-fetch')
const {Blob, blobFrom} = require('node-fetch')
const { Core, Files, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils');
const { async } = require('regenerator-runtime');
const CHUNK_SIZE = 500189; // TEST but set to 5MB 5000000 when done
const unirest = require('unirest')

/**
 * AemFileSpecs type definition
 * @typedef {Object} AemFileSpecs
 * @property {string} [aemFqdn]
 * @property {string} [aemFilePath]
 * @property {string} [aemFileName]
 * @property {string} [token]
 * @property {string} [xApiKey]
 */

/**
 * FileSpecs type definition
 * @typedef {Object} FileSpecs
 * @property {number} [contentLength]
 * @property {string} [contentType]
 * @property {string} [etag]
 * @property {string} [internalUrl]
 * @property {string} [isDirectory]
 * @property {boolean} [isDirectory]
 * @property {boolean} [isPublic]
 * @property {string} [lastModified]
 * @property {string} [name]
 * @property {string} [url]
 */

/**
 * PreSignedData type definition
 * @typedef {Object} PreSignedData
 * @property {string} [cscUtilKey]
 * @property {number} [expiryInSeconds]
 * @property {string} [fileName]
 * @property {string} [permissions]
 * @property {string} [presignedUrl]
 * @property {string} [uploadPath]
 **/

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action move-presigned-response-to-aem')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    //logger.debug(stringParameters(params))

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

    //processState.blockUploadLink = blockUploadLink //TEST
    response.body.processState = processState //TEST
    

    // GET THE FILE SPECS
    let fileSpecs = {}
    try{
      // NOT WORKING const filesProperties = files.getProperties("40434af8ab5775fd5e79f42c261cdff9/6d9ccee3-f019-4b1c-8f78-68d2c9edc763%2Ftest_result_ab4.jpeg")
      // response.body.filesProperties = filesProperties //TEST
      let fileList = await files.list('/') //TEST
      let pathToFetch = `${params.cscUtilKey}/${processState.preSignedData.fileName}`
      logger.debug(`pathToFetch ${pathToFetch}`)
      response.body.filesPropertiesPath = `${params.cscUtilKey}/${processState.preSignedData.fileName}` //TEST
      
      fileList.forEach(file =>{
        if(file.name == pathToFetch){
          logger.debug('FOUND INFO FILE')
          fileSpecs = file// TEST
        }
      })
      //response.body.listTest = JSON.stringify(fileList) //TEST
    }catch(errorMessage){
      return errorResponse(500, `Unable to get file properties for ${params.cscUtilKey}/${processState.preSignedData.fileName} :${errorMessage}`, logger)
    }    
    response.body.filesProperties = fileSpecs //TEST

    //Check the file was uploaded
    if(fileSpecs.contentLength < 1){
      return errorResponse(400, `File has not been uploaded`, logger)
    }

    //Get the AEM file specs
    const aemFileSpecs = {
      aemFqdn: params.aemFqdn,
      aemFilePath: params.aemFilePath,
      aemFileName: params.aemFileName,
      token: token,
      xApiKey: xApiKey
    }
    logger.debug(` `)
    logger.debug(`aemFileSpecs Is`)
    logger.debug(JSON.stringify(aemFileSpecs,null,2))
    logger.debug(` `)

    //GET the block init
    let blockInitUrl = await createBlankAsset(fileSpecs, aemFileSpecs, logger)
    logger.debug(`blockInitUrl ${blockInitUrl}`)
    response.body.createBlankAsset = blockInitUrl // TEST
    let blockTranferSpec = await getblockTransferSpec(blockInitUrl,fileSpecs,aemFileSpecs,logger)
    response.body.blockTranferSpec = blockTranferSpec //TEST

    // Send the file to AEM
    let transferInfo = await startTransfer(aemFileSpecs,files, logger, fileSpecs, blockTranferSpec)
    response.body.transferInfo = transferInfo

    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, `server error ${error.errorMessage}`, logger)
  }
}

/***
 * createBlankAsset 
 * Create the placeholder asset in AEM for the transfer to target
 * 
 * @param {FileSpecs} fileSpecs
 * @param {AemFileSpecs} aemFileSpecs
 * @param {object} logger
 * 
 * @returns {object} blockInit
 */
async function createBlankAsset(fileSpecs,aemFileSpecs,logger) {
  let blockUploadLink //placeholder for the call result 

  try {
      const callOptions = {
        method: 'post',
        headers: {
         "Authorization":aemFileSpecs.token,
         "x-api-key":aemFileSpecs.xApiKey,
         "Content-Type": fileSpecs.contentType
        }
      }

      logger.debug(`createBlankAsset headers`)
      logger.debug(JSON.stringify(callOptions.headers,null,2))

      const placeHolderAssetCallUrl = `https://${aemFileSpecs.aemFqdn}/adobe/repository${aemFileSpecs.aemFilePath};api=create;path=${aemFileSpecs.aemFileName};mode=id`
      const callResult = await fetch(placeHolderAssetCallUrl,callOptions)
      if (!callResult.ok) {
        throw new Error('request to ' + placeHolderAssetCallUrl + ' failed with status code ' + callResult.status)
      }else{
        logger.debug(`CREATE PLACEHOLDER ASSET successful ${callResult.status} !!!!!!!!!!!!`)

        //Get the block upload url from the header
        for (var pair of callResult.headers.entries()) {
          // logger.debug(pair[0]+ ': '+ pair[1])
          if(pair[0] == 'link'){
            blockUploadLink = pair[1].match(/(?<=\<)(.*?)(?=\>)/g)[0] //get just the block upload url
          }
        }

        if(blockUploadLink.length < 5){
          return errorResponse(500, `Unable to do block init ${blockUploadLink} :${errorMessage}`, logger)
        }

        logger.debug(`CREATE PLACEHOLDER ASSET url is ${blockUploadLink} !!!!!!!!!!!!`)
      }
  } catch (errorMessage) {
    return errorResponse(500, `Unable to do block init ${blockUploadLink} :${errorMessage}`, logger)
  }

  return blockUploadLink
}

/***
 * getblockTransferSpec 
 * Get the upload block spec for an asset
 * 
 * @param {string} blockInitUrl
 * @param {FileSpecs} fileSpecs
 * @param {AemFileSpecs} aemFileSpecs
 * @param {object} logger
 * 
 * @returns {object} blockTransferSpec
 */
 async function getblockTransferSpec(blockInitUrl, fileSpecs,aemFileSpecs,logger) {
  let blockInitData

  let blockSpec = {
      "repo:blocksize": CHUNK_SIZE,
      "repo:size": fileSpecs.contentLength,
      "dc:format": fileSpecs.contentType,
      "repo:resource": {
          "repo:reltype": "http://ns.adobe.com/adobecloud/rel/primary"
      }
  }

  // check the block init
  if(blockInitUrl.length < 5){
    return errorResponse(500, `Unable to get block init url`, logger)
  }

  try {
      const callOptions = {
        method: 'post',
        headers: {
         "Authorization":aemFileSpecs.token,
         "x-api-key":aemFileSpecs.xApiKey,
         "Content-Type":"application/vnd.adobecloud.bulk-transfer+json"
        },
        body: JSON.stringify(blockSpec)
      }
      const createRes = await fetch(blockInitUrl,callOptions)
      if (!createRes.ok) {
        throw new Error('request to ' + blockInitUrl + ' failed with status code ' + createRes.status)
      }else{
        logger.debug(`POST BLOCK TRANSFER successful ${createRes.status} !!!!!!!!!!!!`)
      }

      blockInitData = await createRes.json()

  } catch (errorMessage) {
    return errorResponse(500, `Unable to do block init ${blockInitUrl} :${errorMessage}`, logger)
  }

  return blockInitData
}

/**
 * 
 * @param {AemFileSpecs} aemFileSpecs
 * @param {*} logger 
 * @returns 
 */
async function getBlockInit(aemFileSpecs,logger) {
    //Create blank Asset and get block init
    let blockUploadLink
    try{
      const createApiEndpoint = `https://${aemFileSpecs.aemFqdn}/adobe/repository${aemFileSpecs.aemFilePath};api=create;path=${aemFileSpecs.aemFileName};mode=id`
      const createCallOptions = {
        method: 'post',
        headers: {
         "Authorization":aemFileSpecs.token,
         "x-api-key":aemFileSpecs.xApiKey
        }
      }
      const createRes = await fetch(createApiEndpoint,createCallOptions)
      if (!createRes.ok) {
        throw new Error('request to ' + createApiEndpoint + ' failed with status code ' + createRes.status)
      }else{
        logger.debug(`POST CREATE ASSET successful ${createRes.status} !!!!!!!!!!!!`)
      }

      // get the blockUploadApi
      for (var pair of createRes.headers.entries()) {
        if(pair[0] == 'link'){
          blockUploadLink = pair[1].match(/(?<=\<)(.*?)(?=\>)/g)[0] //get just the block upload url
        }
      }

      return blockUploadLink

    }catch(errorMessage){
      return errorResponse(500, `Unable to create empty asset in target ${createApiEndpoint} :${errorMessage}`, logger)
    }
}

/**
 * 
 * @param {AemFileSpecs} aemFileSpecs 
 * @param {object} filesObject 
 * @param {object} logger 
 * @param {FileSpecs} fileSpecs 
 * @param {object} blockTranferSpec 
 * @returns 
 */
 async function startTransfer( aemFileSpecs, filesObject, logger, fileSpecs, blockTranferSpec ) {
  logger.debug(`startTransfer ${aemFileSpecs.aemFileName}`)
  let chunkLoops = blockTranferSpec["_links"]["http://ns.adobe.com/adobecloud/rel/block/transfer"]
  const chunkCount = chunkLoops.length
  const chunkSize = blockTranferSpec["repo:blocksize"]
  let chunkPosition = 0
  let fileData = Buffer.from([])
  //let fileData = ''
  let processInfo = {"status":500}
  processInfo.chunkLoops = chunkLoops
  processInfo.chunkCount = chunkCount
  processInfo.chunkSize = chunkSize
  processInfo.chunkSent = new Array()
  processInfo.format = blockTranferSpec["dc:format"]
  processInfo.finalizeUrl = blockTranferSpec["_links"]["http://ns.adobe.com/adobecloud/rel/block/finalize"]["href"]

  //for await(const data of fileTransferStream) {
  for(let i = 0; (i < chunkCount); i++){
      let fileTransferStream 
      if(chunkSize > fileSpecs.contentLength){
        logger.debug('chunk larger, full read')
        fileTransferStream = await filesObject.createReadStream(fileSpecs.name)
      }else{
        logger.debug('chunk smaller, part read')
        fileTransferStream = await filesObject.createReadStream(fileSpecs.name,{position:chunkPosition,length:chunkSize})
      }

      for await(const data of fileTransferStream) {
        fileData = Buffer.concat([fileData, data], fileData.length+data.length)
      }

      logger.debug(`Writing chunk i=${i} chunkSize=${chunkSize} contentLength=${fileSpecs.contentLength} arrayLength=${fileData.length} chunkPosition=${chunkPosition}`)
      let sentPartResult = await sendFilePartToAem(chunkLoops[i]["href"],fileData,aemFileSpecs,blockTranferSpec["dc:format"],logger) 
      let chunkInfo = {
        "i":i,
        "arrayLength":fileData.length,
        "chunkPosition": chunkPosition,
        "format": blockTranferSpec["dc:format"],
        "chunkUrl": chunkLoops[i]["href"],
        "chunkCallStatus": sentPartResult
      }
      processInfo.chunkSent.push(chunkInfo)
      chunkPosition =  chunkPosition + chunkSize
  }

  processInfo.chunkPosition = chunkPosition
  processInfo.contentLength = fileSpecs.contentLength
  processInfo.fileDataLength = fileData.length

  //get the remainder
  logger.debug(``)
  logger.debug(``)
  logger.debug(`Starting final chunk ${chunkPosition}`)
  logger.debug(`Block Specs`)
  logger.debug(JSON.stringify(blockTranferSpec,null,5))
  logger.debug(``)
  logger.debug(`File Specs`)
  logger.debug(JSON.stringify(fileSpecs,null,5))
  logger.debug(``)
  logger.debug(`AEM File Specs`)
  logger.debug(JSON.stringify(aemFileSpecs,null,5))
  logger.debug(``)
  
  if(chunkPosition>=blockTranferSpec["repo:size"]){
    logger.debug(`Writing FINAL !!!!!!!!`)

    processInfo.finalize = {
      "blockTranferSpec": blockTranferSpec,
      "url": processInfo.finalizeUrl
    }
    try {
      const callOptionsFinal = {
        method: 'POST',
        headers: {
         "Content-Type":"application/vnd.adobecloud.bulk-transfer+json"
        },
        body: JSON.parse(JSON.stringify(blockTranferSpec))
      }
      const finalRes = await fetch(processInfo.finalizeUrl,callOptionsFinal)

      processInfo.finalize.status = finalRes.status

      if (!finalRes.ok) {
        //throw new Error('POST FINALIZE to ' + blockTranferSpec["_links"]["http://ns.adobe.com/adobecloud/rel/block/finalize"]["href"] + ' failed with status code ' + postRes.status)
      }else{
        logger.debug(`POST FINAL successful ${postRes.status} !!!!!!!!!!!!`)
      }

      return processInfo
  
    } catch (errorMessage) {
      processInfo.finalize.status = 500
      processInfo.finalize.error = errorMessage
      //return errorResponse(500, `Unable to POST ${blockTranferSpec["_links"]["http://ns.adobe.com/adobecloud/rel/block/finalize"]["href"]} :${errorMessage}`, logger)
    }
  }else{
    processInfo.status = 504
    logger.debug(`Something funky happened ${chunkPosition}`)
  }

  return processInfo
}

/***
 * Send the file part to AEM
 * 
 * @param {string} transferUrl
 * @param {object} data
 * @param {AemFileSpecs} aemFileSpecs
 * @param {string} contentType
 * @param {object} logger
 */
async function sendFilePartToAem(transferUrl,data,aemFileSpecs,contentType,logger){
  logger.debug(`sendFilePartToAem ${transferUrl} ${contentType}`)
  //logger.debug(JSON.stringify(aemFileSpecs,null,2))
  let processInfo = {}

  try {
    let res = await unirest('PUT', transferUrl)
    .headers({
      'Content-Type': contentType,
    })
    .send(data)

    // return true
    processInfo.status = res.status
    processInfo.body = res.raw_body

    if (res.error){
      processInfo.status = res.status
      processInfo.body = error
    }
    // const callOptions = {
    //   method: 'put',
    //   headers: {
    //    //"Authorization":aemFileSpecs.token,
    //    //"x-api-key":aemFileSpecs.xApiKey,
    //    "Content-Type":contentType
    //   },
    //   body: data,
    //   duplex: 'half'
    // }
    // const putRes = await fetch(transferUrl,callOptions)
    // if (!putRes.ok) {
    //   throw new Error('PUT to ' + transferUrl + ' failed with status code ' + putRes.status)
    // }else{
    //   //putRes.body.body = data
    //   logger.debug(`PUT to ${transferUrl} successful ${putRes.status} !!!!!!!!!!!!`)
    // }

  } catch (errorMessage) {
    processInfo.status = 500
    processInfo.body = errorMessage
    //return errorResponse(500, `Unable PUT ${transferUrl} :${errorMessage}`, logger)
  }

  return processInfo
}

exports.main = main
