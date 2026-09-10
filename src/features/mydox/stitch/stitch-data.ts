import { Brain, HeartPulse, ScanLine, TestTube } from "lucide-react";

// Illustrative content from the owner's Stitch export. Never live provider data.
export const exampleDoctors = [
  {
    id: "krishna",
    name: "Dr. Krishna Patel",
    specialty: "Neurologist",
    image: "krishna.jpg",
    experience: "14 years",
    summary: "Brain, nerve and spinal care, with a thoughtful approach to every visit.",
    clinic: "MyDox Neuro Care Centre",
    fee: 600,
  },
  {
    id: "charlotte",
    name: "Dr. Charlotte Adams",
    specialty: "Cardiologist",
    image: "charlotte.jpg",
    experience: "12 years",
    summary: "Heart health and ongoing cardiovascular care, all in one place.",
    clinic: "MyDox Heart Care Centre",
    fee: 700,
  },
];
export const exampleTests = [
  {
    id: "mri",
    name: "High-resolution Brain MRI",
    category: "MRI & CT",
    label: "IMAGING CENTRE",
    detail: "1.5T / 3.0T MRI",
    description: "Explore imaging centres, appointment options and report preferences.",
    delivery: "At the centre",
    fee: 5500,
    icon: Brain,
    tone: "blue",
  },
  {
    id: "vital",
    name: "Comprehensive Vital Health Panel",
    category: "Health checks",
    label: "HOME SAMPLE COLLECTION",
    detail: "Health check panel",
    description: "A sample layout for reviewing the tests included in your health check.",
    delivery: "Home or lab visit",
    fee: 1200,
    icon: TestTube,
    tone: "mint",
  },
  {
    id: "ecg",
    name: "Digital 12-lead ECG",
    category: "Heart care",
    label: "TECHNICIAN VISIT",
    detail: "Heart health",
    description: "Choose your visit preferences and review available options.",
    delivery: "Home or centre visit",
    fee: 600,
    icon: HeartPulse,
    tone: "rose",
  },
  {
    id: "ct",
    name: "Chest CT scan (HRCT)",
    category: "MRI & CT",
    label: "IMAGING CENTRE",
    detail: "CT imaging",
    description: "A focused booking page for your scan and collection of reports.",
    delivery: "At the centre",
    fee: 3500,
    icon: ScanLine,
    tone: "blue",
  },
];
export const sampleDates = ["10", "11", "12", "13", "14", "15", "16"];
export const weekdays = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
export const sampleSlots = [
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "02:30 PM",
  "04:00 PM",
  "05:30 PM",
  "06:15 PM",
];
export const areas = [
  "Koregaon Park",
  "Wakad",
  "Baner",
  "Kothrud",
  "Aundh",
  "Viman Nagar",
  "Hadapsar",
  "Kharadi",
];
export const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;
