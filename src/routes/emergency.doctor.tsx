import {createFileRoute} from '@tanstack/react-router';
import {EmergencyPortal} from '@/features/mydox/emergency/DispatchScreens';
export const Route = createFileRoute('/emergency/doctor')({ssr:false,component:Screen});
function Screen(){return <EmergencyPortal kind="doctor"/>;}
