import { Button } from "@/components/ui/button";
import { Upload, Play, Download, Zap } from "lucide-react";
import heroImage from "@/assets/hero-video-editing.jpg";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-dark">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional video editing interface" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-dark opacity-80" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <div className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border backdrop-blur-sm">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-muted-foreground">AI-Powered Video Blurring</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent leading-tight">
            Blur Videos
            <br />
            <span className="text-foreground">Like a Pro</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Intelligently blur sensitive content in your videos with precision timing controls. 
            Upload, edit, and download professional-quality results in minutes Hello.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button variant="hero" size="xl" className="min-w-[200px]">
              <Upload className="w-5 h-5" />
              Start Blurring
            </Button>
            <Button variant="outline" size="xl" className="min-w-[200px]">
              <Play className="w-5 h-5" />
              Watch Demo
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl bg-card/30 border border-border backdrop-blur-sm hover:bg-card/40 transition-all duration-300">
              <Upload className="w-8 h-8 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Bulk Upload</h3>
              <p className="text-muted-foreground">Upload multiple videos at once with intelligent queuing</p>
            </div>
            
            <div className="p-6 rounded-xl bg-card/30 border border-border backdrop-blur-sm hover:bg-card/40 transition-all duration-300">
              <Zap className="w-8 h-8 text-accent mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Precision Control</h3>
              <p className="text-muted-foreground">Time-specific blurring with interactive mask placement</p>
            </div>
            
            <div className="p-6 rounded-xl bg-card/30 border border-border backdrop-blur-sm hover:bg-card/40 transition-all duration-300">
              <Download className="w-8 h-8 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">High Quality</h3>
              <p className="text-muted-foreground">Download professional-grade processed videos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
    </section>
  );
};