import {createFileRoute} from '@tanstack/react-router';
import {EmergencyPortal} from '@/features/mydox/emergency/DispatchScreens';
export const Route = createFileRoute('/admin/emergency')({ssr:false,component:Screen});
function Screen(){return <EmergencyPortal kind="admin"/>;}
