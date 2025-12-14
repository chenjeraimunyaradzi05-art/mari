@php($icon = $icon ?? 'default')

@switch($icon)
    @case('home')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5 12 4l9 6.5M4.5 9.75V20h4.5v-4.5h6V20h4.5V9.75" />
        </svg>
        @break

    @case('profile')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5a8.25 8.25 0 0 1 15 0" />
        </svg>
        @break

    @case('sparkles')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25h.008v.008H9V8.25Zm4.5 0h.008v.008H13.5V8.25Zm-6 4.5h.008v.008H7.5v-.008Zm7.5 0h.008v.008H15v-.008Zm4.5-3-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5m-15-6-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5m3-9L9 6l3-3 3 3 1.5-1.5" />
        </svg>
        @break

    @case('network')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm9 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm-9 12a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm9 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM3 6.75l3.75 2.25m10.5 0L21 6.75M3 17.25l3.75-2.25m10.5 0L21 17.25M9.75 12h4.5" />
        </svg>
        @break

    @case('camera')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5h-.264a2.25 2.25 0 0 0-2.1 1.471l-1.157 3.19a1.5 1.5 0 0 0 1.414 2.014H6.75m10.5-6h.264a2.25 2.25 0 0 1 2.1 1.471l1.157 3.19a1.5 1.5 0 0 1-1.414 2.014H17.25M6.75 7.5l-.3-.9A1.35 1.35 0 0 1 7.74 5.25h8.52a1.35 1.35 0 0 1 1.29 1.35l-.3.9m-10.5 0h10.5m-3 3.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        @break

    @case('refresh')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.192V5.156m.004 8.88a8.25 8.25 0 0 1-13.947 5.814L3 18.222m4.192-3.07H3V19.2m-.004-8.88a8.25 8.25 0 0 1 13.947-5.814L21 5.778" />
        </svg>
        @break

    @case('invite')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M4.5 4.5h4.5m4.5 0H18M6 8.25h12A1.5 1.5 0 0 1 19.5 9.75v9A1.5 1.5 0 0 1 18 20.25H6A1.5 1.5 0 0 1 4.5 18.75v-9A1.5 1.5 0 0 1 6 8.25Z" />
        </svg>
        @break

    @case('pen')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-3.177.956.956-3.177a4.5 4.5 0 011.13-1.897L16.862 4.487zm0 0L19.5 7.125" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        @break

    @case('calendar')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M4.5 7.5h15" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 6h13.5A2.25 2.25 0 0121 8.25v10.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75h.008v.008H16.5v-.008zm-4.5 0h.008v.008H12v-.008zm-4.5 0h.008v.008H7.5v-.008zm9 3.75h.008v.008H16.5V16.5zm-4.5 0h.008v.008H12V16.5zm-4.5 0h.008v.008H7.5V16.5z" />
        </svg>
        @break

    @case('layers')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5l9-4.5 9 4.5-9 4.5-9-4.5z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9 4.5 9-4.5" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5l9 4.5 9-4.5" />
        </svg>
        @break

    @case('video')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5v-5.625c0-.621-.504-1.125-1.125-1.125H4.875c-.621 0-1.125.504-1.125 1.125v9.75c0 .621.504 1.125 1.125 1.125H14.625c.621 0 1.125-.504 1.125-1.125V13.5L20.25 17v-10l-4.5 3.5z" />
        </svg>
        @break

    @case('shield')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8.25 3v6c0 5.25-3.875 9.75-8.25 10.5C7.625 21.75 3.75 17.25 3.75 12V6L12 3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
        </svg>
        @break

    @case('document')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 7.5h6M9 12h6m-6 4.5h6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h6.879a1.5 1.5 0 0 1 1.06.44l4.121 4.12A1.5 1.5 0 0 1 20 8.62V19.5A1.5 1.5 0 0 1 18.5 21h-11A1.5 1.5 0 0 1 6 19.5V4.5z" />
        </svg>
        @break

    @case('chat')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3h6m-6 3h3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12c0 4.556 3.694 8.25 8.25 8.25.974 0 1.917-.162 2.793-.462A1.5 1.5 0 0 1 15 21l3.75 1.5-.75-3.75a8.19 8.19 0 0 0 .75-3.75c0-4.556-3.694-8.25-8.25-8.25s-8.25 3.694-8.25 8.25Z" />
        </svg>
        @break

    @case('map-pin')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21.75s7.5-6.188 7.5-11.25A7.5 7.5 0 0 0 12 3a7.5 7.5 0 0 0-7.5 7.5c0 5.063 7.5 11.25 7.5 11.25Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
        @break

    @case('sun')
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m5.303-.803-1.591 1.591M21 12h-2.25m-.803 5.303-1.591-1.591M12 18.75V21m-3.712-3.288l-1.59 1.59M5.25 12H3m3.288-3.712-1.59-1.59M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
        </svg>
        @break

    @default
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3" />
        </svg>
@endswitch
