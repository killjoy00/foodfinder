import { addRestaurantAction } from "@/app/actions";
import { RestaurantForm } from "@/components/RestaurantForm";

export default function NewRestaurantPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">Add a place</h1>
      <RestaurantForm action={addRestaurantAction} submitLabel="Add restaurant" />
    </div>
  );
}
