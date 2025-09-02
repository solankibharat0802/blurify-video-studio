import { Card } from "@/components/ui/card";
import { 
  MousePointer, 
  Clock, 
  Layers, 
  Zap, 
  Shield, 
  Download,
  BarChart3,
  Palette
} from "lucide-react";

const features = [
  {
    icon: MousePointer,
    title: "Interactive Editing",
    description: "Drag and place blur masks with pixel-perfect precision directly on your video preview",
    gradient: "from-primary to-accent"
  },
  {
    icon: Clock,
    title: "Time Controls",
    description: "Set exact start and end times for each blur effect with frame-level accuracy",
    gradient: "from-accent to-primary"
  },
  {
    icon: Layers,
    title: "Multiple Masks",
    description: "Apply unlimited blur masks to different areas with independent timing controls",
    gradient: "from-primary to-purple-500"
  },
  {
    icon: Zap,
    title: "Real-time Preview",
    description: "See your edits instantly with hardware-accelerated video playback",
    gradient: "from-accent to-pink-500"
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "All processing happens securely with optional local-only processing mode",
    gradient: "from-primary to-green-500"
  },
  {
    icon: Download,
    title: "High Quality Export",
    description: "Download your processed videos in original quality with optimized compression",
    gradient: "from-accent to-orange-500"
  },
  {
    icon: BarChart3,
    title: "Batch Processing",
    description: "Process multiple videos simultaneously with intelligent queue management",
    gradient: "from-primary to-blue-500"
  },
  {
    icon: Palette,
    title: "Custom Effects",
    description: "Choose from multiple blur styles including gaussian, motion, and pixelation",
    gradient: "from-accent to-indigo-500"
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-6 bg-card/20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Powerful Features for
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Professional Results</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Everything you need to create perfectly blurred videos with precision and speed
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index}
                className="p-6 hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 bg-card/50 border-border backdrop-blur-sm"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">99.9%</div>
            <div className="text-muted-foreground">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">50x</div>
            <div className="text-muted-foreground">Faster Processing</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">500+</div>
            <div className="text-muted-foreground">Video Formats</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">4K</div>
            <div className="text-muted-foreground">Max Resolution</div>
          </div>
        </div>
      </div>
    </section>
  );
};