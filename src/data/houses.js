// Polígonos de exemplo (GeoJSON Features) — use coordenadas reais ao testar
export default [
  {
    type: 'Feature',
    properties: { name: 'Quadra A' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-122.4338, 37.7893],
          [-122.4328, 37.7893],
          [-122.4328, 37.7886],
          [-122.4338, 37.7886],
          [-122.4338, 37.7893]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    properties: { name: 'Quadra B' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-122.4315, 37.7880],
          [-122.4306, 37.7880],
          [-122.4306, 37.7873],
          [-122.4315, 37.7873],
          [-122.4315, 37.7880]
        ]
      ]
    }
  }
];