import { createFileRoute } from '@tanstack/react-router';
import { EmergencyPortal } from '@/features/mydox/emergency/DispatchScreens';
export const Route = createFileRoute('/emergency/ambulance')({ ssr: false, component: Screen });
function Screen() { return <EmergencyPortal kind="ambulance" />; }
