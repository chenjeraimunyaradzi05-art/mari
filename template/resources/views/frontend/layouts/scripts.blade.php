<script>
    (function () {
        'use strict';

        if (typeof window.Notyf !== 'undefined') {
            window.notyf = window.notyf || new Notyf({ duration: 5000 });
        }

        if (typeof window.jQuery === 'undefined') {
            return;
        }

        var $ = window.jQuery;

        $('.datepicker').datepicker({
            format: 'yyyy-m-d'
        });

        $('.yearpicker').datepicker({
            format: 'yyyy',
            viewMode: 'years',
            minViewMode: 'years'
        });

        var editorElement = document.querySelector('#editor');
        if (editorElement && typeof window.ClassicEditor !== 'undefined') {
            window.ClassicEditor.create(editorElement).catch(function (error) {
                console.error('CKEditor initialization error:', error);
            });
        }

        window.showLoader = function () {
            $('.preloader_demo').removeClass('d-none');
        };

        window.hideLoader = function () {
            $('.preloader_demo').addClass('d-none');
        };

        $('body').on('click', '.delete-item', function (event) {
            event.preventDefault();
            var url = $(this).attr('href');

            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(function (result) {
                if (!result.isConfirmed) {
                    return;
                }

                $.ajax({
                    method: 'DELETE',
                    url: url,
                    data: { _token: '{{ csrf_token() }}' },
                    beforeSend: window.showLoader,
                    success: function () {
                        window.location.reload();
                    },
                    error: function (xhr) {
                        var message = (xhr.responseJSON && xhr.responseJSON.message) || 'Something went wrong.';
                        if (typeof window.swal === 'function') {
                            window.swal(message, { icon: 'error' });
                        } else {
                            alert(message);
                        }
                        window.hideLoader();
                    }
                });
            });
        });
    }());
</script>
