<script lang="ts">
	import { tv } from 'tailwind-variants';

	export let value: string = '';
	export let placeholder: string = 'Select an option';
	export let disabled: boolean = false;
	export let required: boolean = false;
	export let name: string = '';
	export let id: string = '';
	export let className: string = '';

	// Event handlers
	export let onchange: ((event: Event) => void) | undefined = undefined;
	export let onfocus: ((event: Event) => void) | undefined = undefined;
	export let onblur: ((event: Event) => void) | undefined = undefined;

	const select = tv({
		base: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300',
		variants: {
			variant: {
				default: 'border-slate-200',
				error: 'border-red-500 focus:ring-red-500'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export let variant: 'default' | 'error' = 'default';
</script>

<select
	{value}
	{disabled}
	{required}
	{name}
	{id}
	class={select({ variant, class: className })}
	onchange={onchange}
	onfocus={onfocus}
	onblur={onblur}
	{...$$restProps}
>
	<option value="" disabled selected={!value}>{placeholder}</option>
	<slot />
</select> 