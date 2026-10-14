/** Frozen primary-source extraction: Kaminsky, Arena & Myers (2015),
 * DOI 10.1016/j.mayocp.2015.07.026, Tables 3 (FRIEND rows only) and 4.
 * US laboratory referral/research sample; not a probability sample of the world.
 * Reviewed 2026-10-14. Keep this version explicit when newer studies are added. */
export const FRIEND_REFERENCE_VERSION='friend-2015-treadmill-v1';
export const FRIEND_SOURCE='https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/';
export const FRIEND_PERCENTILES=[5,10,25,50,75,90,95] as const;
export const friend2015={
 male:[
  {mean:47.6,sd:11.3,n:513,quantiles:[29,32.1,40.1,48,55.2,61.8,66.3]},
  {mean:43,sd:9.9,n:963,quantiles:[27.2,30.2,35.9,42.4,49.2,56.5,59.8]},
  {mean:38.8,sd:9.6,n:1327,quantiles:[24.2,26.8,31.9,37.8,45,52.1,55.6]},
  {mean:33.8,sd:9.1,n:1078,quantiles:[20.9,22.8,27.1,32.6,39.7,45.6,50.7]},
  {mean:29.4,sd:7.9,n:593,quantiles:[17.4,19.8,23.7,28.2,34.5,40.3,43]},
  {mean:25.8,sd:7.1,n:137,quantiles:[16.3,17.1,20.4,24.4,30.4,36.6,39.7]},
 ],
 female:[
  {mean:37.6,sd:10.2,n:410,quantiles:[21.7,23.9,30.5,37.6,44.7,51.3,56]},
  {mean:30.9,sd:8,n:608,quantiles:[19,20.9,25.3,30.2,36.1,41.4,45.8]},
  {mean:27.9,sd:7.7,n:843,quantiles:[17,18.8,22.1,26.7,32.4,38.4,41.7]},
  {mean:24.2,sd:6.1,n:805,quantiles:[16,17.3,19.9,23.4,27.6,32,35.9]},
  {mean:20.7,sd:5,n:408,quantiles:[13.4,14.6,17.2,20,23.8,27,29.4]},
  {mean:18.3,sd:3.6,n:98,quantiles:[13.1,13.6,15.6,18.3,20.8,23.1,24.1]},
 ],
};
