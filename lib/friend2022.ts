/** Frozen primary-source extraction, reviewed 2026-10-15.
 * Kaminsky et al., Mayo Clinic Proceedings 97 (2022), 285–293.
 * DOI 10.1016/j.mayocp.2021.08.020. Tables 2 and 3, TREADMILL ONLY,
 * peak RER >= 1.0. No known CVD or COPD; US laboratory registry.
 * Nine published decile thresholds; no interpolation or tail extrapolation.
 * This supersedes the 2015 reference for new calculations, not old snapshots.
 */
export const FRIEND_REFERENCE_VERSION='friend-2022-treadmill-rer1-v1';
export const FRIEND_SOURCE='https://www.mayoclinicproceedings.org/article/S0025-6196(21)00645-5/fulltext';
export const FRIEND_PERCENTILES=[10,20,30,40,50,60,70,80,90] as const;
export const friend2022={
  "male": [
    {
      "mean": 45.2,
      "sd": 11.8,
      "n": 1278,
      "quantiles": [
        28.6,
        35.2,
        40.0,
        43.6,
        46.5,
        49.0,
        51.9,
        54.5,
        58.6
      ]
    },
    {
      "mean": 40.0,
      "sd": 11.8,
      "n": 1473,
      "quantiles": [
        24.9,
        29.8,
        33.5,
        37.0,
        39.7,
        43.4,
        46.4,
        50.0,
        55.5
      ]
    },
    {
      "mean": 35.8,
      "sd": 10.8,
      "n": 2119,
      "quantiles": [
        22.1,
        26.7,
        29.7,
        32.4,
        35.3,
        37.9,
        40.9,
        45.2,
        50.8
      ]
    },
    {
      "mean": 30.2,
      "sd": 9.7,
      "n": 2082,
      "quantiles": [
        18.6,
        22.2,
        24.5,
        26.9,
        29.2,
        31.8,
        34.3,
        38.3,
        43.4
      ]
    },
    {
      "mean": 25.4,
      "sd": 8.3,
      "n": 1663,
      "quantiles": [
        15.8,
        18.5,
        20.7,
        22.8,
        24.6,
        26.5,
        28.7,
        32.0,
        37.1
      ]
    },
    {
      "mean": 21.2,
      "sd": 6.5,
      "n": 776,
      "quantiles": [
        13.6,
        15.9,
        17.3,
        19.1,
        20.6,
        22.2,
        23.8,
        25.9,
        29.4
      ]
    },
    {
      "mean": 17.9,
      "sd": 3.9,
      "n": 173,
      "quantiles": [
        12.9,
        14.8,
        16.1,
        16.6,
        17.6,
        18.4,
        20.0,
        21.4,
        22.8
      ]
    }
  ],
  "female": [
    {
      "mean": 36.3,
      "sd": 10.2,
      "n": 1142,
      "quantiles": [
        22.5,
        27.2,
        30.8,
        34.0,
        36.6,
        39.0,
        41.8,
        44.8,
        49.0
      ]
    },
    {
      "mean": 29.5,
      "sd": 9.0,
      "n": 1043,
      "quantiles": [
        18.6,
        21.9,
        24.2,
        26.4,
        28.3,
        31.0,
        33.6,
        37.0,
        42.1
      ]
    },
    {
      "mean": 26.6,
      "sd": 8.1,
      "n": 1372,
      "quantiles": [
        17.2,
        19.7,
        21.8,
        23.9,
        25.7,
        27.7,
        30.0,
        33.0,
        37.8
      ]
    },
    {
      "mean": 23.8,
      "sd": 6.6,
      "n": 1457,
      "quantiles": [
        16.5,
        18.5,
        20.1,
        21.5,
        22.9,
        24.6,
        26.3,
        28.4,
        32.4
      ]
    },
    {
      "mean": 20.0,
      "sd": 5.5,
      "n": 1045,
      "quantiles": [
        13.4,
        15.4,
        17.0,
        18.3,
        19.6,
        20.9,
        22.4,
        24.3,
        27.3
      ]
    },
    {
      "mean": 17.5,
      "sd": 4.2,
      "n": 549,
      "quantiles": [
        12.3,
        14.0,
        15.2,
        16.2,
        17.2,
        18.3,
        19.6,
        20.8,
        22.8
      ]
    },
    {
      "mean": 15.9,
      "sd": 4.8,
      "n": 106,
      "quantiles": [
        11.4,
        12.6,
        13.7,
        14.7,
        15.4,
        16.0,
        17.3,
        18.4,
        20.8
      ]
    }
  ]
};
