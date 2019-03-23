'use strict';

let expect = require('chai').expect;
let fs = require('fs');
let parseGeoraster = require(`../dist/${process.env.GEORASTER_TEST_BUNDLE_NAME}`);
let parseMetadata = require('../src/parse_metadata.js');
let parseISO = parseMetadata.parseISO;

describe('Parsing Data Object', function() {
   describe('Parsing Simple Examples', function() {
      it('should create raster correctly', function(done) {
        this.timeout(5000);
        const values = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
        const noDataValue = 3;
        const projection = 4326;
        const xmin = -40;
        const ymax = 14;
        const pixelWidth = 0.01;
        const pixelHeight = 0.01;
        const metadata = { noDataValue, projection, xmin, ymax, pixelWidth, pixelHeight };
        parseGeoraster(values, metadata).then(georaster => {
            try {
                console.log("georaster:", georaster);
                expect(georaster.numberOfRasters).to.equal(1);
                expect(georaster.projection).to.equal(projection);
                expect(georaster.noDataValue).to.equal(noDataValue);
                expect(georaster.xmin).to.equal(xmin);
                expect(georaster.xmax).to.equal(-39.97);
                expect(georaster.ymin).to.equal(13.97);
                expect(georaster.ymax).to.equal(ymax);
                expect(georaster.pixelHeight).to.equal(georaster.pixelHeight);
                expect(georaster.pixelWidth).to.equal(georaster.pixelWidth);
                expect(JSON.stringify(georaster.values)).to.equal(JSON.stringify(values));
                done();
            } catch (error) {
                console.error("Error parsing from simple object", error);
            }
        });
      });
   }) ;
});

describe('Parsing Rasters', function() {
  describe('Parsing OSGEO Samples', function() {
    it('should parse data/GeogToWGS84GeoKey5.tif', function(done) {
        this.timeout(50000);
        fs.readFile('data/GeogToWGS84GeoKey5.tif', (error, data) => {
            parseGeoraster(data).then(georaster => {
                try {
                    expect(georaster.numberOfRasters).to.equal(1);
                    expect(georaster.projection).to.equal(32767);
                    expect(georaster.values[0]).to.have.lengthOf(georaster.height);
                    expect(georaster.values[0][0]).to.have.lengthOf(georaster.width);
                    done();
                } catch (error) {
                    console.error('error:', error);
                }
            });
        });
    });
  });
});

describe('Checking Error Catching', function() {
  describe('if you pass in undefined', function() {
    it('should throw an error', function() {
        try {
            parseGeoraster(undefined);
        } catch (error) {
            let actual_error_message = error.toString();
            let expected_error_message = 'Error: [Georaster.parseGeoraster] Error. You passed in undefined to parseGeoraster. We can\'t make a raster out of nothing!';
            expect(actual_error_message).to.equal(expected_error_message);
        }
    });
  });
});


describe('Parsing Metadata', function() {
  describe('if you pass in iso xml text', function() {
    it('should parse metadata', function(done) {
        fs.readFile('data/iso.xml', 'utf8', (error, data) => {
            let parsed = parseISO(data);
            expect(parsed.projection).to.equal(4326);
            expect(parsed.xmin).to.equal(10.2822923743907);
            expect(parsed.xmax).to.equal(13.3486486092171);
            expect(parsed.ymin).to.equal(44.418521542726054);
            expect(parsed.ymax).to.equal(47.15260827566466);
            done();
        });
    });
  });
});


// Using tiff created from http://geomap.arpa.veneto.it/geoserver/wcs?crs=EPSG%3A4326&service=WCS&format=GeoTIFF&request=GetCoverage&height=329&width=368&version=1.0.0&BBox=9.679858245722988%2C13.951082737884812%2C44.183855724634675%2C47.38727409375604&Coverage=geonode%3Aatlanteil
describe('Parsing Geonode Files', function() {
  describe('if you pass in tiff from geoserver', function() {
    it('should parse correctly', function(done) {
        fs.readFile('data/geonode_atlanteil.tif', (error, data) => {
            parseGeoraster(data, null, true).then(parsed => {
                expect(parsed.projection).to.equal(4326);
                expect(parsed.xmin).to.equal(10.2822923743907);
                expect(parsed.xmax).to.equal(13.3486486092171);
                expect(parsed.ymin).to.equal(44.418521542726054);
                expect(parsed.ymax).to.equal(47.15260827566466);
                expect(parsed.values.length).to.equal(1);
                expect(parsed.values[0].length).to.equal(329);
                expect(parsed.values[0][0].length).to.equal(368);
                expect(parsed.maxs[0]).to.equal(5.398769378662109);
                expect(parsed.mins[0]).to.equal(0);
                done();
            });
        });
    });
  });
});

describe('Parsing RGB Rasters', function() {
  describe('Parsing RGB Raster', function() {
    it('should parse data/rgb_raster.tif', function(done) {
        this.timeout(50000);
        fs.readFile('data/rgb_raster.tif', (error, data) => {
            parseGeoraster(data).then(first_georaster => {
                try {
                    console.log("georaster:", first_georaster);
                    expect(first_georaster.numberOfRasters).to.equal(3);
                    expect(first_georaster.projection).to.equal(4326);
                    const expected_height = 3974;
                    const expected_width = 7322;
                    expect(first_georaster.values[0]).to.have.lengthOf(expected_height);
                    expect(first_georaster.values[0][0]).to.have.lengthOf(expected_width);
                    expect(first_georaster.pixelHeight).to.equal(0.0002695191463334987);
                    expect(first_georaster.pixelWidth).to.equal(0.0002695191463334988);
                    expect(first_georaster.xmin).to.equal(-125.57865783690451);
                    expect(first_georaster.noDataValue).to.equal(null);

                    //removing old data
                    delete first_georaster._data;

                    parseGeoraster(first_georaster.values, first_georaster).then(secondary_georaster => {
                        console.log("secondary_georaster:", secondary_georaster);
                        expect(secondary_georaster.numberOfRasters).to.equal(3);
                        expect(secondary_georaster.height).to.equal(expected_height);
                        done();
                    });
                } catch (error) {
                    console.error('error:', error);
                }
            });
        });
    });
  });
});
