import AppKit
import AVFoundation
let W=1920, H=1080, fps=30
func ease(_ x:Double)->Double { let v=max(0,min(1,x)); return 1-pow(1-v,3) }
func color(_ hex:Int,_ a:Double=1)->NSColor { NSColor(red:Double((hex>>16)&255)/255,green:Double((hex>>8)&255)/255,blue:Double(hex&255)/255,alpha:a) }
func text(_ s:String,_ x:Double,_ y:Double,_ size:Double,_ col:NSColor = .white){let p=NSMutableParagraphStyle();s.draw(at:NSPoint(x:x,y:y),withAttributes:[.font:NSFont.systemFont(ofSize:size,weight:.semibold),.foregroundColor:col,.paragraphStyle:p])}
let palette=[0xf87171,0xfb7185,0xf59e0b,0xfbbf24,0xa3e635,0x6ee7b7,0x34d399,0x2dd4bf,0x22d3ee,0x38bdf8,0x60a5fa,0x818cf8,0x818cf8,0x64748b]
let tiers=["1%","2.5%","5%","7.5%","10%","15%","20%","25%","30%","35%","45%","55%","65%","65%+"]
func render(_ name:String,_ seconds:Int,_ scene:Int) throws {
 let url=URL(fileURLWithPath:FileManager.default.currentDirectoryPath+"/output/video/"+name+".mp4");try? FileManager.default.removeItem(at:url)
 let writer=try AVAssetWriter(outputURL:url,fileType:.mp4)
 let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:W,AVVideoHeightKey:H,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:10000000]])
 let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:W,kCVPixelBufferHeightKey as String:H,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true]);writer.add(input);guard writer.startWriting() else { fatalError(String(describing:writer.error)) };writer.startSession(atSourceTime:.zero)
 for frame in 0..<(seconds*fps) {autoreleasepool {
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.002)}
 var b:CVPixelBuffer?;CVPixelBufferCreate(nil,W,H,kCVPixelFormatType_32ARGB,[kCVPixelBufferCGImageCompatibilityKey:true,kCVPixelBufferCGBitmapContextCompatibilityKey:true] as CFDictionary,&b);let buffer=b!;CVPixelBufferLockBaseAddress(buffer,[])
 let ctx=CGContext(data:CVPixelBufferGetBaseAddress(buffer),width:W,height:H,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:ctx,flipped:false)
 let t=Double(frame)/Double(fps)
 ctx.setFillColor(color(0x081326).cgColor);ctx.fill(CGRect(x:0,y:0,width:W,height:H))
 text("TOP1.FIT",100,965,30,color(0x93bfff));text("HUMAN POTENTIAL",1450,965,23,color(0x8197b6))
 if scene==0 {
 text("Build your potential.",100,835,66);text("One level at a time.",100,785,28,color(0x9ab4d4))
 for i in (0..<14).reversed(){let a=ease((t-0.5-Double(13-i)*0.42)/0.8);let y=150+Double(13-i)*40;let w=Double(32+i*24);let lift=35*(1-a);let path=CGMutablePath();path.move(to:CGPoint(x:960-w,y:y-lift));path.addLine(to:CGPoint(x:960+w,y:y-lift));path.addLine(to:CGPoint(x:960+w-19,y:y+31-lift));path.addLine(to:CGPoint(x:960-w+19,y:y+31-lift));path.closeSubpath();ctx.setFillColor(color(palette[i],a).cgColor);ctx.addPath(path);ctx.fillPath();if a>0.8{text(tiers[i],1340,y,24,color(palette[i],a))}}
 let a=ease((t-7)/0.7);text("TOP 1%",100,490,98,color(0xf87171,a));text("THE SUMMIT",105,455,24,color(0xf87171,a));text("Product-defined challenge tiers",100,65,21,color(0x8197b6))
 } else {
 text("Measure your capacity.",100,835,66)
 let groups=[("STRENGTH",0xfb7185,["Push-ups","Pull-ups","Dips","Grip strength","VO₂ max","5 km run"]),("BODYMARKERS",0x60a5fa,["Body fat","Waist-to-height ratio","Fasting glucose"]),("RECOVERY",0x34d399,["Sleep duration","Resting heart rate","Heart rate variability"])]
 for (j,g) in groups.enumerated(){let x=100+Double(j)*590;let a=ease((t-Double(j)*0.5)/0.8);text(g.0,x,730,32,color(g.1,a));for (i,m) in g.2.enumerated(){let p=ease((t-0.8-Double(j)*0.5-Double(i)*0.4)/0.7),y=620-Double(i)*80;ctx.setFillColor(color(0x1b304d,p).cgColor);ctx.fill(CGRect(x:x+40*(1-p),y:y,width:530,height:65));text(m,x+20+40*(1-p),y+18,26,color(0xe9f2ff,p));ctx.setFillColor(color(g.1,p).cgColor);ctx.fill(CGRect(x:x,y:y,width:3,height:65))}}
 text("Track your progress. Start your climb.",100,65,28,color(0x9ab4d4))
 }
 NSGraphicsContext.restoreGraphicsState();CVPixelBufferUnlockBaseAddress(buffer,[]);adaptor.append(buffer,withPresentationTime:CMTime(value:Int64(frame),timescale:Int32(fps)))
 }}
 input.markAsFinished();let sem=DispatchSemaphore(value:0);writer.finishWriting{sem.signal()};sem.wait();if let e=writer.error {throw e};print("Rendered \(url.path)")
}
try render("01-pyramid-to-top-1",11,0)
try render("02-metrics-reveal",12,1)
