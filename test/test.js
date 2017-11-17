'use strict';

let expect = require('chai').expect;
let fs = require("fs");
let parse_georaster = require("../src/georaster.js");

describe('Parsing Rasters', function() {
  /*describe('Parsing OSGEO Samples', function() {
    it('should parse data/GeogToWGS84GeoKey5.tif', function(done) {
        this.timeout(50000);
        fs.readFile("data/GeogToWGS84GeoKey5.tif", (error, data) => {
            parse_georaster(data).then(georaster => {
                try {
                    expect(georaster.number_of_rasters).to.equal(1);
                    expect(georaster.projection).to.equal(32767);
                    expect(georaster.values[0]).to.have.lengthOf(georaster.height);
                    expect(georaster.values[0][0]).to.have.lengthOf(georaster.width);
                    done();
                } catch (error) {
                    console.error("error:", error);
                }
            });
        });
    });
  });*/
  describe("Parsing Visible Earth", function() {
    it("should parsed world.topo.bathy.200407.3x5400x2700.jpg", function(done) {
        let path_to_file = "data/VisibleEarth/world.topo.bathy.200407.3x5400x2700.jpg";
        fs.readFile(path_to_file, (error, data) => {
            parse_georaster(data).then(georaster => {
                console.log("georaster:", georaster);
            });
        });
    });
  });
  describe('Parsing JPEGS', function() {
    /*
    it('should parse data/exif-gps-samples', function(done) {
        this.timeout(50000);
        let path_to_folder = "data/exif-gps-samples/";
        fs.readdir(path_to_folder, (err, files) => {
            files.forEach(file => {
                let path_to_file = path_to_folder + file;
                console.log("path_to_file:", path_to_file);
                fs.readFile(path_to_file, (error, data) => {
                    console.log("data:", data);
                    parse_georaster(data).then(georaster => {
                        try {
                            console.log("georaster:", georaster);
                            expect(georaster.number_of_rasters).to.equal(1);
                            expect(georaster.projection).to.equal(32767);
                            expect(georaster.values[0]).to.have.lengthOf(georaster.height);
                            expect(georaster.values[0][0]).to.have.lengthOf(georaster.width);
                            done();
                        } catch (error) {
                            console.error("error:", error);
                        }
                    });
                });
            });
        });
    });
    */
  });
});
