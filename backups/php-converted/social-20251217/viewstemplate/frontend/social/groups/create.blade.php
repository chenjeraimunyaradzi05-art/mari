@extends('frontend.social.layout')

@section('social-content')
<div class="max-w-3xl mx-auto space-y-8">
    <div class="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl">
        <h1 class="text-3xl font-bold">Create a New Group</h1>
        <p class="mt-2 text-purple-100">Bring professionals together around a shared interest, project, or goal.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-md p-8">
        <form id="create-group-form" method="POST" action="{{ route('member.social.groups.store') }}" class="space-y-6">
            @csrf

            <div>
                <label for="name" class="block text-sm font-semibold text-gray-700">Group Name</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value="{{ old('name') }}"
                    class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="e.g. Product Designers Collective"
                    required
                >
                @error('name')
                    <p class="mt-2 text-sm text-red-500">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="description" class="block text-sm font-semibold text-gray-700">Description</label>
                <textarea
                    id="description"
                    name="description"
                    rows="4"
                    class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Tell members what this group is all about"
                >{{ old('description') }}</textarea>
                @error('description')
                    <p class="mt-2 text-sm text-red-500">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="visibility" class="block text-sm font-semibold text-gray-700">Visibility</label>
                <select
                    id="visibility"
                    name="visibility"
                    class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:ring-purple-500"
                >
                    <option value="public" {{ old('visibility', 'public') === 'public' ? 'selected' : '' }}>Public — anyone can find and join</option>
                    <option value="private" {{ old('visibility') === 'private' ? 'selected' : '' }}>Private — invite or approval required</option>
                </select>
                @error('visibility')
                    <p class="mt-2 text-sm text-red-500">{{ $message }}</p>
                @enderror
            </div>

            <div class="flex items-center justify-end gap-3">
                <a href="{{ route('member.social.groups') }}" class="px-5 py-3 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300">Cancel</a>
                <button type="submit" class="px-5 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">Create Group</button>
            </div>
        </form>
    </div>
</div>
@endsection

@push('scripts')
<script>
    document.getElementById('create-group-form')?.addEventListener('submit', function (event) {
        const submitButton = this.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.setAttribute('disabled', 'disabled');
            submitButton.classList.add('opacity-70');
        }
    });
</script>
@endpush
