'use strict';

// import this library in case you don't use the web worker
let fileType = require('file-type');
let GeoTIFF = require("geotiff");
let Jimp = require("jimp");
//let piexif = require("piexifjs");
let EXIFParser = require("exif-parser");
//let ExifReader = require("exifreader");
//global.DataView = require('jdataview');
//let EXIF = require("exif-js");
//let ExifImage = require('exif').ExifImage;
//let EXIFParser = require("exif-parser");

/*let getFileType = (file) => {
    console.log("file:", file);
}*/

let parse_data = (data) => {

    console.log("\n[georaster] starting parse_data");

    try {

        let result = {
            _arrayBuffer: data.arrayBuffer
        };

        let height, no_data_value, width;

        console.log("got to promise section");

        return new Promise((resolve, reject) => {
            try {
                if (data.raster_type === "geotiff") {

                    //console.log("data.raster_type is geotiff");
                    let geotiff = GeoTIFF.parse(data.arrayBuffer);
                    //console.log("geotiff:", geotiff);

                    let image = geotiff.getImage();

                    let fileDirectory = image.fileDirectory;

                    result.projection = image.getGeoKeys().GeographicTypeGeoKey;

                    result.height = height = image.getHeight();
                    result.width = width = image.getWidth();

                    // https://www.awaresystems.be/imaging/tiff/tifftags/modeltiepointtag.html
                    result.xmin = fileDirectory.ModelTiepoint[3];
                    result.ymax = fileDirectory.ModelTiepoint[4];

                    // https://www.awaresystems.be/imaging/tiff/tifftags/modelpixelscaletag.html
                    result.pixelHeight = fileDirectory.ModelPixelScale[1];
                    result.pixelWidth = fileDirectory.ModelPixelScale[0];

                    result.xmax = result.xmin + width * result.pixelWidth;
                    result.ymin = result.ymax - height * result.pixelHeight;

                    // SRTM can have implicit no data values of 32767 or 32768 without it being tagged as such
                    result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;


                    //console.log("no_data_value:", no_data_value);

                    result.number_of_rasters = fileDirectory.SamplesPerPixel;

                    result.values = image.readRasters().map(values_in_one_dimension => {
                        let values_in_two_dimensions = [];
                        for (let y = 0; y < height; y++) {
                            let start = y * width;
                            let end = start + width;
                            values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                        }
                        //console.log("values_in_two_dimensions:", values_in_two_dimensions);
                        return values_in_two_dimensions;
                    });
                    resolve(result);
                } else if (data.raster_type === "jpeg") {
                    console.log("data.raster_type is jpeg");
                    Jimp.read(data.arrayBuffer, (err, image) => {
                        console.log("decoded arrayBuffer:", image);
                        result.height = height = image.bitmap.height;
                        result.width = width = image.bitmap.width;
                    });
                    let parser = EXIFParser.create(data.arrayBuffer);
                    let exif = parser.parse();
                    console.log("exif:", exif);
                    //let exifObj = piexif.load(data.arrayBuffer);
                    /*parser.enablePointers([true]);
                    parser.enableBinaryFields([true]);
                    parser.enableTagNames([true]);
                    console.log("exist data:", exifObj.tags);
                    */
                    //let tags = ExifReader.load(data.arrayBuffer);
                    //let tags = EXIF.getTag("
                    //let tags = EXIF.readFromBinaryFile(data.arrayBuffer);
                    //console.log("tags:", tags);

                    //let arrayBuffer = data.arrayBuffer.buffer.slice(data.arrayBuffer.byteOffset, data.arrayBuffer.byteOffset + data.arrayBuffer.byteLength);
                    //let sliced = data.arrayBuffer.slice(0, 131072);
                    /*let sliced = data.arrayBuffer.slice(0, 100).toString();
                    console.log("sliced:", sliced);
                    let first = new Uint8Array(sliced).forEach(n => {
                        console.log("n:", (n).toString(16));
                    });
                    let exifData = EXIFParser.create(data.arrayBuffer).parse();
                    console.log("exifData:", exifData);
                    console.log("GPSLatitude:", exifData.tags["GPSLatitude"]);
                //result.xmin = fileDirectory.ModelTiepoint[3];
                //result.ymax = fileDirectory.ModelTiepoint[4];
                });

		*/
                }
            } catch (error) {
                console.error("[georaster] Error parsing raster:", error);
            }
        }).then(result => {
            try {
                result.maxs = [];
                result.mins = [];
                result.ranges = [];

                let max; let min;

                //console.log("starting to get min, max and ranges");
                for (let raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

                    let rows = result.values[raster_index];

                    for (let row_index = 0; row_index < height; row_index++) {

                        let row = rows[row_index];

                        for (let column_index = 0; column_index < width; column_index++) {

                            let value = row[column_index];
                            if (value != no_data_value) {
                                if (typeof min === "undefined" || value < min) min = value;
                                else if (typeof max === "undefined" || value > max) max = value;
                            }
                        }
                    }

                    result.maxs.push(max);
                    result.mins.push(min);
                    result.ranges.push(max - min);
                }
                return result;
            } catch (error) {
                console.error("[georaster] Error calculating maxs, mins and ranges of raster:", error);
            }
        });

    } catch (error) {

        console.error("error:", error);

    }

}
 

let web_worker_script = `

    // this is a bit of a hack to trick geotiff to work with web worker
    let window = self;

    let parse_data = ${parse_data.toString()};
    //console.log("inside web worker, parse_data is", parse_data);

    try {
        /* Need to find a way to do this with webpack */
        importScripts("https://unpkg.com/geotiff@0.4.1/dist/geotiff.browserify.min.js");
    } catch (error) {
        console.error(error);
    }

    onmessage = e => {
        //console.error("inside worker on message started with", e); 
        parse_data(e.data).then(result => {
            console.log("posting from web wroker:", result);
            postMessage(result, [result._arrayBuffer]);
            close();
        });
    }
`;

class GeoRaster {

    constructor(arrayBuffer) {
        //console.log("starting GeoRaster.constructor with", arrayBuffer.toString());

        if (typeof arrayBuffer === "undefined") {
            throw "[georaster] tried constructing GeoRaster with an undefined ArrayBuffer";
        }

        this.file_type = fileType(arrayBuffer);
        console.log("this.file_type:", this.file_type);
        if (this.file_type.ext === "tif") {
            this.raster_type = "geotiff";
            if (typeof Buffer !== "undefined" && Buffer.isBuffer(arrayBuffer)) {
                arrayBuffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
            }
        } else if (this.file_type.ext === "jpg") {
            this.raster_type = "jpeg";
            if (typeof Buffer !== "undefined" && Buffer.isBuffer(arrayBuffer)) {
                //arrayBuffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
            }
        } 
        this._arrayBuffer = arrayBuffer;
        this._web_worker_is_available = typeof window !== "undefined" && window.Worker !== "undefined";
        this._blob_is_available = typeof Blob !== "undefined";
        this._url_is_available = typeof URL !== "undefined";

        //console.log("this after construction:", this);
    }


    initialize() {
        return new Promise((resolve, reject) => {
            //console.log("starting GeoRaster.values getter");
            if (this.raster_type === "geotiff" || this.raster_type === "jpeg") {
                if (this._web_worker_is_available) {
                    let url;
                    if (this._blob_is_available) {
                        let blob = new Blob([web_worker_script], {type: 'application/javascript'});
                        //console.log("blob:", blob);
                        if (this._url_is_available) {
                            url = URL.createObjectURL(blob);
                            //console.log("url:", url);
                        }
                    }
                    var worker = new Worker(url);
                    //console.log("worker:", worker);
                    worker.onmessage = (e) => {
                        console.log("main thread received message:", e);
                        let data = e.data;
                        for (let key in data) {
                            this[key] = data[key];
                        }
                        resolve(this);
                    };
                    //console.log("about to postMessage");
                    worker.postMessage({arrayBuffer: this._arrayBuffer, raster_type: this.raster_type}, [this._arrayBuffer]);
                } else {
                    console.log("web worker is not available");
                    parse_data({ arrayBuffer: this._arrayBuffer, raster_type: this.raster_type }).then(result => {
                        console.log("result:", result);
                        resolve(result);
                    });
                }
            } else {
                reject("couldn't find a way to parse");
            }
        });
    }

}

module.exports = (input) => new GeoRaster(input).initialize();
