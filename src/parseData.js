import { fromArrayBuffer } from 'geotiff';
import { log } from './logger.js';

function processResult(result, debug) {
  const noDataValue = result.noDataValue;
  const height = result.height;
  const width = result.width;

  return new Promise((resolve, reject) => {
    result.maxs = [];
    result.mins = [];
    result.ranges = [];

    let max; let min;

    for (let rasterIndex = 0; rasterIndex < result.numberOfRasters; rasterIndex++) {
      const rows = result.values[rasterIndex];
      if (debug) log('rows:', rows);

      for (let rowIndex = 0; rowIndex < height; rowIndex++) {
        const row = rows[rowIndex];

        for (let columnIndex = 0; columnIndex < width; columnIndex++) {
          const value = row[columnIndex];
          if (value != noDataValue && !isNaN(value)) {
            if (typeof min === 'undefined' || value < min) min = value;
            else if (typeof max === 'undefined' || value > max) max = value;
          }
        }
      }

      result.maxs.push(max);
      result.mins.push(min);
      result.ranges.push(max - min);
    }

    resolve(result);
  });
}

// not using async because running into this error: ReferenceError: regeneratorRuntime is not defined
export default function parseData(data, debug) {
  if (debug) log('starting parseData');
  return new Promise((resolve, reject) => {
    try {
      if (debug) log('\tGeoTIFF:', typeof GeoTIFF);

      const result = {};

      let height, width;

      if (data.rasterType === 'object') {
        result.values = data.data;
        result.height = height = data.metadata.height || result.values[0].length;
        result.width = width = data.metadata.width || result.values[0][0].length;
        result.pixelHeight = data.metadata.pixelHeight;
        result.pixelWidth = data.metadata.pixelWidth;
        result.projection = data.metadata.projection;
        result.xmin = data.metadata.xmin;
        result.ymax = data.metadata.ymax;
        result.noDataValue = data.metadata.noDataValue;
        result.numberOfRasters = result.values.length;
        result.xmax = result.xmin + result.width * result.pixelWidth;
        result.ymin = result.ymax - result.height * result.pixelHeight;
        result._data = null;
        resolve(processResult(result));
      } else if (data.rasterType === 'geotiff') {
        result._data = data.data;

        if (debug) log('data.rasterType is geotiff');
        resolve(fromArrayBuffer(data.data).then(geotiff => {
          if (debug) log("fromArrayBuffer succeded");
          if (debug) log('geotiff:', geotiff);
          return geotiff.getImage().then(image => {
            if (debug) log('image:', image);

            const fileDirectory = image.fileDirectory;

            const geoKeys = image.getGeoKeys();

            if (debug) log('geoKeys:', geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) log('projection:', result.projection);

            result.height = height = image.getHeight();
            if (debug) log('result.height:', result.height);
            result.width = width = image.getWidth();
            if (debug) log('result.width:', result.width);

            const [resolutionX, resolutionY] = image.getResolution();
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            const [originX, originY] = image.getOrigin();
            result.xmin = originX;
            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymax = originY;
            result.ymin = result.ymax - height * result.pixelHeight;

            result.noDataValue = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;

            result.numberOfRasters = fileDirectory.SamplesPerPixel;

            return image.readRasters().then(rasters => {
              result.values = rasters.map(valuesInOneDimension => {
                const valuesInTwoDimensions = [];
                for (let y = 0; y < height; y++) {
                  const start = y * width;
                  const end = start + width;
                  valuesInTwoDimensions.push(valuesInOneDimension.slice(start, end));
                }
                return valuesInTwoDimensions;
              });
              return processResult(result);
            });
          });
        })
        .catch(error => {
          log("fromArrayBuffer found error:", error);
        }));
      }
    } catch (error) {
      console.error('[georaster] error parsing georaster:', error);
    }
  });
}
