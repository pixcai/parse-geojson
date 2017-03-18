(function (root, factory) {
	'use strict'

	if (typeof define === 'function' && define.amd) {
		define(['module'], function (module) {
			module.exports = factory(root)
		})
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = factory(root)
	} else {
		root.parseGeoJSON = factory(root)
	}
}(this, function (root) {
	'use strict'

	function decodeCoordinate(coordinate, encodeOffset) {
		var result = []
		var cx, cy
		var offset = encodeOffset.slice()

		for (var i = 0, L = coordinate.length; i < L; i += 2) {
			cx = coordinate.charCodeAt(i) - 64
			cy = coordinate.charCodeAt(i + 1) - 64
			cx = ((cx >> 1) ^ (-(cx & 1))) + offset[0]
			cy = ((cy >> 1) ^ (-(cy & 1))) + offset[1]
			offset[0] = cx
			offset[1] = cy
			result.push([cx / 1024, cy / 1024])
		}

		return result
	}

	function decodeGeoJSON(geoJSON) {
		var decoder = {
			MultiPolygon: function (coordinate, encodeOffset) {
				var result = []

				for (var j = 0, N = coordinate.length; j < N; j++) {
					result.push(decodeCoordinate(
						coordinate[j], 
						encodeOffset[j]
					))
				}

				return result
			}, 
			Polygon: decodeCoordinate
		}
		var features = []

		if (typeof geoJSON === 'string') {
			geoJSON = JSON.parse(geoJSON)
		}
		features = geoJSON.features
		// If is unminified json format, do nothing
		if (!geoJSON.UTF8Encoding) {
			return geoJSON
		}

		for (var i = 0, M = features.length; i < M; i++) {
			var geometry = features[i].geometry
			var coordinates = geometry.coordinates
			var encodeOffsets = geometry.encodeOffsets

			coordinates.forEach(function (coordinate, index) {
				coordinates[index] = decoder[geometry.type](
					coordinate, 
					encodeOffsets[index]
				)
			})
		}
		geoJSON.UTF8Encoding = false

		return geoJSON
	}

	function Region(name, contours, center) {
		this.name = name
		this.contours = contours

		if (!center) {
			var boundingRect = this.getBoundingRect()
			
			center = [
				(boundingRect.xMin + boundingRect.xMax) / 2, 
				(boundingRect.yMin + boundingRect.yMax) / 2
			]
		}
		this.center = center
	}

	Region.prototype.getBoundingRect = function () {
		var getBoundingRect = function (contour, MAX_NUMBER) {
			var min = [MAX_NUMBER, MAX_NUMBER], max = [-MAX_NUMBER, -MAX_NUMBER]

			contour.forEach(function (coordinate) {
				min[0] = Math.min(min[0], coordinate[0])
				max[0] = Math.max(max[0], coordinate[0])
				min[1] = Math.min(min[1], coordinate[1])
				max[1] = Math.max(max[1], coordinate[1])
			})

			return {
				xMin: min[0], 
				yMin: min[1], 
				xMax: max[0], 
				yMax: max[1]
			}
		}
		var result = {}

		for (var i = 0, L = this.contours.length; i < L; i++) {
			var boundingRect = getBoundingRect(this.contours[i], Number.MAX_VALUE)

			result.xMin = Math.min(result.xMin, boundingRect.xMin)
			result.xMax = Math.min(result.xMax, boundingRect.xMax)
			result.yMin = Math.min(result.yMin, boundingRect.yMin)
			result.yMax = Math.min(result.yMax, boundingRect.yMax)
		}

		return result
	}

	return function (geoJSON) {
		var decodedGeoJSON = decodeGeoJSON(geoJSON)
		var features = decodedGeoJSON.features.filter(function (feature) {
			return (
				feature.properties 
				&& feature.geometry 
				&& feature.geometry.coordinates.length > 0
			)
		})

		return features.map(function (feature) {
			var geometry = feature.geometry
			var coordinates = geometry.coordinates

			if (geometry.type === 'MultiPolygon') {
				coordinates.forEach(function (coordinate) {
					var result = []

					for (var i = 0, M = coordinate.length; i < M; i++) {
						for (var j = 0, N = coordinate[i].length; j < N; j++) {
							result.push(coordinate[i][j])
						}
					}

					return result
				})
			}

			return new Region(
				feature.properties.name, 
				coordinates, 
				feature.properties.cp
			)
		})
	}
}))
