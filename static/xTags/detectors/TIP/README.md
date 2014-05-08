###TIPWall

`<detector-TIPWall>` inherits all the standard functionality from `xDetectorTemplate` and `setupDetector`; since it is a very simple visualization, the TIP Wall serves as a good first example of real use of these objects.

####Attributes
 - `MIDAS`: host:port of the MIDAS experiment the HV frontends for this detector are living at.
 - `rateServer`: full URL of JSONP post of scalar rate information for the TIP Wall.  JSON should be wrapped in a `parseRate(data)` function at this URL.
 - `thresholdServer`: full URL of JSONP post of threshold information for the TIP Wall.  JSON should be wrapped in a `parseThreshold(data)` function at this URL.