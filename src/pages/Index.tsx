import { HeroSection } from "@/components/hero-section";
import { UploadSection } from "@/components/upload-section";
import { FeaturesSection } from "@/components/features-section";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <UploadSection />
      <FeaturesSection />
    </div>
  );
};

export default Index;