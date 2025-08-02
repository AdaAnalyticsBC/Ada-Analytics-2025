<script lang="ts">
	import { tv } from 'tailwind-variants';
	import type { HTMLInputAttributes } from 'svelte/elements';

	export let value: string = '';
	export let placeholder: string = '';
	export let type: HTMLInputAttributes['type'] = 'text';
	export let disabled: boolean = false;
	export let required: boolean = false;
	export let name: string = '';
	export let id: string = '';
	export let className: string = '';

	// Event handlers
	export let oninput: ((event: Event) => void) | undefined = undefined;
	export let onchange: ((event: Event) => void) | undefined = undefined;
	export let onfocus: ((event: Event) => void) | undefined = undefined;
	export let onblur: ((event: Event) => void) | undefined = undefined;

	const input = tv({
		base: 'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300',
		variants: {
			variant: {
				default: 'border-slate-200',
				error: 'border-red-500 focus-visible:ring-red-500'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export let variant: 'default' | 'error' = 'default';
</script>

<input
	{type}
	{value}
	{placeholder}
	{disabled}
	{required}
	{name}
	{id}
	class={input({ variant, class: className })}
	oninput={oninput}
	onchange={onchange}
	onfocus={onfocus}
	onblur={onblur}
	{...$$restProps}
/> 